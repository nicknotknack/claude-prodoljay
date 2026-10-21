#!/usr/bin/env node
// prodoljay — schedule a Claude Code prompt to start later in a new terminal window.
//
//   schedule --at <time> [--cwd dir] [--effort level] [--safe] [--prompt-file path]   (prompt on stdin otherwise)
//   test [--cwd dir]   schedule a test prompt one minute from now
//   list [--all]
//   cancel <id|all>
//   wait <id>   internal: detached waiter that keeps the machine awake and opens the terminal
//   run <id>    internal: runs claude inside the opened terminal
//
// Jobs live in ~/.claude/prodoljay/jobs/<id>/ (job.json, prompt.md, waiter.log).
// verified.json appears after the first passed test; until then each schedule adds a test job.
// No dependencies; Node 18+. macOS and Windows.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const HOME = path.join(os.homedir(), '.claude', 'prodoljay');
const JOBS = path.join(HOME, 'jobs');
const POLL_MS = 15_000;
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const ACTIVE = new Set(['pending', 'launched', 'running']);
const VERIFIED = path.join(HOME, 'verified.json');
const TEST_PROMPT = 'Say what day of the week and what date it is today, in one short sentence.';

// ---------- helpers ----------

function fail(msg) {
  console.error(`prodoljay: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--safe' || a === '--all') out[a] = true;
    else if (a.startsWith('--')) out[a] = argv[++i];
    else out._.push(a);
  }
  return out;
}

const jobDir = (id) => path.join(JOBS, id);
const jobFile = (id) => path.join(jobDir(id), 'job.json');

function loadJob(id) {
  return JSON.parse(fs.readFileSync(jobFile(id), 'utf8'));
}

function saveJob(job) {
  const tmp = `${jobFile(job.id)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(job, null, 2));
  fs.renameSync(tmp, jobFile(job.id));
}

function updateJob(id, patch) {
  const job = { ...loadJob(id), ...patch };
  saveJob(job);
  return job;
}

function allJobs() {
  if (!fs.existsSync(JOBS)) return [];
  return fs
    .readdirSync(JOBS)
    .filter((id) => fs.existsSync(jobFile(id)))
    .map(loadJob)
    .sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt));
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// A pending job whose waiter died (reboot, logout, killed) will never fire.
function effectiveStatus(job) {
  return job.status === 'pending' && !isAlive(job.waiterPid) ? 'lost' : job.status;
}

// Child processes start a fresh top-level claude session, so drop the nested-session marker they would inherit.
delete process.env.CLAUDECODE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- time ----------

// Accepts: 00:15, 9:30, 9.30, 12:15 AM, 7pm, 2026-10-22 09:00, +2h, +90m, +1h30m.
// A clock time already past today means tomorrow.
function parseTime(input, now = new Date()) {
  const s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');

  const rel = s.match(/^\+ ?(?:(\d+) ?h)? ?(?:(\d+) ?m(?:in)?)?$/);
  if (rel && (rel[1] || rel[2])) {
    return new Date(now.getTime() + ((+rel[1] || 0) * 60 + (+rel[2] || 0)) * 60_000);
  }

  let date = null;
  let clock = s;
  const dated = s.match(/^(\d{4})-(\d{2})-(\d{2})[ t](.+)$/);
  if (dated) {
    date = [+dated[1], +dated[2] - 1, +dated[3]];
    clock = dated[4];
  }

  const m = clock.match(/^(\d{1,2})(?:[:.](\d{2}))? ?(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m || (!m[2] && !m[3])) throw new Error(`can't parse time "${input}" (try 00:15, 12:15 AM, 7pm, +2h)`);
  let h = +m[1];
  const min = +(m[2] || 0);
  const ampm = m[3]?.[0];
  if (min > 59) throw new Error(`bad minutes in "${input}"`);
  if (ampm) {
    if (h < 1 || h > 12) throw new Error(`bad hour in "${input}"`);
    h = (h % 12) + (ampm === 'p' ? 12 : 0);
  } else if (h > 23) throw new Error(`bad hour in "${input}"`);

  const d = date ? new Date(date[0], date[1], date[2], h, min) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
  if (d <= now) {
    if (date) throw new Error(`"${input}" is in the past`);
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function fmtWhen(d) {
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtIn(ms) {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ---------- platform ----------

function findClaude() {
  const r = spawnSync(IS_WIN ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  const found = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!IS_WIN) {
    if (!found[0]) fail('claude not found in PATH');
    return { command: found[0], args: [] };
  }
  const exe = found.find((p) => p.toLowerCase().endsWith('.exe'));
  if (exe) return { command: exe, args: [] };
  // npm install: claude.cmd shim next to node_modules/@anthropic-ai/claude-code/cli.js
  for (const p of found) {
    const cli = path.join(path.dirname(p), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (fs.existsSync(cli)) return { command: process.execPath, args: [cli] };
  }
  fail('claude not found in PATH');
}

// Keeps the machine from sleeping while process `pid` is alive. The display may still turn off.
function keepAwake(pid) {
  let child;
  if (IS_MAC) {
    child = spawn('caffeinate', ['-ims', '-w', String(pid)], { stdio: 'ignore' });
  } else if (IS_WIN) {
    const ps = [
      `$t = Add-Type -Name K -Namespace PJ -PassThru -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'`,
      `[void]$t::SetThreadExecutionState([uint32]2147483649)`, // ES_CONTINUOUS | ES_SYSTEM_REQUIRED
      `Wait-Process -Id ${pid}`,
    ].join('; ');
    const encoded = Buffer.from(ps, 'utf16le').toString('base64');
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: 'ignore', windowsHide: true });
  } else {
    child = spawn('systemd-inhibit', ['--what=idle:sleep', '--why=prodoljay', 'tail', `--pid=${pid}`, '-f', '/dev/null'], { stdio: 'ignore' });
  }
  child.on('error', (e) => console.error(`keep-awake unavailable: ${e.message}`));
}

const shQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const asQuote = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function openTerminal(job) {
  const cmd = [process.execPath, SCRIPT, 'run', job.id];
  if (IS_MAC) {
    const line = cmd.map(shQuote).join(' ');
    const r = spawnSync('osascript', ['-e', 'tell application "Terminal"', '-e', 'activate', '-e', `do script ${asQuote(line)}`, '-e', 'end tell'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`osascript failed: ${(r.stderr || '').trim()}`);
  } else if (IS_WIN) {
    const line = ['start', '"prodoljay"', ...cmd.map((s) => `"${s}"`)].join(' ');
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${line}"`], { windowsVerbatimArguments: true, detached: true, stdio: 'ignore' });
    child.unref();
  } else {
    throw new Error('opening a terminal is supported on macOS and Windows only');
  }
}

// ---------- commands ----------

// Creates a job and starts its detached waiter.
function createJob({ runAt, prompt, cwd, effort = null, bypassPermissions = true, test = false }) {
  const id = randomBytes(3).toString('hex');
  fs.mkdirSync(jobDir(id), { recursive: true });
  fs.writeFileSync(path.join(jobDir(id), 'prompt.md'), prompt);
  const job = {
    id,
    test,
    status: 'pending',
    runAt: runAt.toISOString(),
    createdAt: new Date().toISOString(),
    cwd,
    effort,
    bypassPermissions,
    claude: findClaude(),
    preview: prompt.replace(/\s+/g, ' ').slice(0, 80),
    waiterPid: null,
  };
  saveJob(job);

  const log = fs.openSync(path.join(jobDir(id), 'waiter.log'), 'a');
  const waiter = spawn(process.execPath, [SCRIPT, 'wait', id], { detached: true, stdio: ['ignore', log, log], windowsHide: true });
  waiter.unref();
  return updateJob(id, { waiterPid: waiter.pid });
}

function printTestJob(job) {
  console.log(`Test job ${job.id}`);
  console.log(`  runs at:  ${fmtWhen(new Date(job.runAt))} (in ${fmtIn(Date.parse(job.runAt) - Date.now())})`);
  console.log(`  checks:   a terminal window opens and \`claude -p\` answers "${TEST_PROMPT}"`);
}

function cmdSchedule(opts) {
  if (!opts['--at']) fail('missing --at <time>');
  let runAt;
  try {
    runAt = parseTime(opts['--at']);
  } catch (e) {
    fail(e.message);
  }

  const prompt = (opts['--prompt-file'] ? fs.readFileSync(opts['--prompt-file'], 'utf8') : fs.readFileSync(0, 'utf8')).trim();
  if (!prompt) fail('empty prompt');

  const cwd = path.resolve(opts['--cwd'] || process.cwd());
  if (!fs.statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) fail(`no such directory: ${cwd}`);

  const job = createJob({ runAt, prompt, cwd, effort: opts['--effort'] || null, bypassPermissions: !opts['--safe'] });

  console.log(`Scheduled job ${job.id}`);
  console.log(`  runs at:  ${fmtWhen(runAt)} (local time)`);
  console.log(`  in:       ${fmtIn(runAt - Date.now())}`);
  console.log(`  dir:      ${cwd}`);
  console.log(`  flags:    ${[job.bypassPermissions && '--permission-mode bypassPermissions', job.effort && `--effort ${job.effort}`].filter(Boolean).join(' ') || '(none)'}`);
  console.log(`  prompt:   ${job.preview}${prompt.length > 80 ? '…' : ''}`);

  // Until one test has passed on this machine, every schedule also runs a test a minute from now.
  if (!isVerified()) {
    console.log('\nFIRST RUN on this machine: a test prompt was scheduled too. Watch the terminal window that opens.');
    printTestJob(createTestJob(cwd));
  }
}

function cmdTest(opts) {
  printTestJob(createTestJob(path.resolve(opts['--cwd'] || process.cwd())));
}

const isVerified = () => fs.existsSync(VERIFIED);

function createTestJob(cwd) {
  return createJob({ runAt: new Date(Date.now() + 60_000), prompt: TEST_PROMPT, cwd, bypassPermissions: false, test: true });
}

function cmdList(opts) {
  const dayAgo = Date.now() - 24 * 3600_000;
  const jobs = allJobs().filter((j) => opts['--all'] || ACTIVE.has(j.status) || Date.parse(j.runAt) > dayAgo);
  if (!jobs.length) return console.log('No scheduled prompts.');
  for (const j of jobs) {
    const runAt = new Date(j.runAt);
    const status = effectiveStatus(j);
    const when = status === 'pending' ? `${fmtWhen(runAt)} (in ${fmtIn(runAt - Date.now())})` : fmtWhen(runAt);
    console.log(`${j.id}  ${status.padEnd(9)} ${when}${j.test ? '  [test]' : ''}`);
    console.log(`        dir: ${j.cwd}`);
    console.log(`        prompt: ${j.preview}`);
    if (j.error) console.log(`        error: ${j.error}`);
  }
  if (jobs.some((j) => effectiveStatus(j) === 'lost')) console.log('\n"lost" = the waiter process is gone (reboot/logout); the prompt will not run. Schedule it again.');
}

function cmdCancel(opts) {
  const target = opts._[0];
  if (!target) fail('usage: cancel <id|all>');
  const jobs = allJobs().filter((j) => j.status === 'pending' && (target === 'all' || j.id.startsWith(target)));
  if (!jobs.length) fail(`no pending job matches "${target}" (already launched jobs run in their own terminal window — close it to stop)`);
  for (const j of jobs) {
    updateJob(j.id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    if (isAlive(j.waiterPid)) {
      try {
        process.kill(j.waiterPid);
      } catch {}
    }
    console.log(`Cancelled ${j.id}  (${fmtWhen(new Date(j.runAt))}: ${j.preview})`);
  }
}

async function cmdWait(id) {
  keepAwake(process.pid);
  console.log(`${new Date().toISOString()} waiting for ${loadJob(id).runAt}`);
  // Poll the wall clock instead of one long timer, so time spent asleep is accounted for.
  for (;;) {
    const job = loadJob(id);
    if (job.status !== 'pending') return console.log(`${new Date().toISOString()} job is ${job.status}, exiting`);
    const left = Date.parse(job.runAt) - Date.now();
    if (left <= 0) break;
    await sleep(Math.min(POLL_MS, left));
  }
  try {
    openTerminal(loadJob(id));
    updateJob(id, { status: 'launched', launchedAt: new Date().toISOString() });
    console.log(`${new Date().toISOString()} terminal opened`);
  } catch (e) {
    updateJob(id, { status: 'failed', error: e.message });
    console.error(`${new Date().toISOString()} ${e.message}`);
  }
}

function cmdRun(id) {
  const job = loadJob(id);
  const prompt = fs.readFileSync(path.join(jobDir(id), 'prompt.md'), 'utf8');
  process.chdir(job.cwd);
  keepAwake(process.pid);
  const args = [...job.claude.args];
  if (job.test) args.push('-p');
  if (job.bypassPermissions) args.push('--permission-mode', 'bypassPermissions');
  if (job.effort) args.push('--effort', job.effort);
  args.push(prompt);
  updateJob(id, { status: 'running', startedAt: new Date().toISOString() });
  if (job.test) console.log(`prodoljay test ${id}: ${prompt}\n`);
  const child = spawn(job.claude.command, args, { stdio: 'inherit' });
  child.on('error', (e) => {
    updateJob(id, { status: 'failed', error: e.message });
    console.error(`prodoljay: ${e.message}`);
    finish(job, 1);
  });
  child.on('exit', (code) => {
    updateJob(id, { status: code === 0 ? 'finished' : 'failed', exitCode: code, finishedAt: new Date().toISOString(), ...(code === 0 ? {} : { error: `claude exited with code ${code}` }) });
    if (job.test && code === 0) fs.writeFileSync(VERIFIED, JSON.stringify({ at: new Date().toISOString(), platform: process.platform, job: id }, null, 2));
    finish(job, code ?? 0);
  });
}

// Test windows stay open so the result can be read (a Windows console closes on exit).
function finish(job, code) {
  if (!job.test) process.exit(code);
  console.log(code === 0 ? '\n✓ prodoljay test passed: scheduled prompts work on this machine.' : `\n✗ prodoljay test failed (exit code ${code}).`);
  console.log('Press Enter to close.');
  process.stdin.once('data', () => process.exit(code));
}

// ---------- main ----------

const [command, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);
switch (command) {
  case 'schedule':
    cmdSchedule(opts);
    break;
  case 'list':
    cmdList(opts);
    break;
  case 'test':
    cmdTest(opts);
    break;
  case 'cancel':
    cmdCancel(opts);
    break;
  case 'wait':
    await cmdWait(opts._[0]);
    break;
  case 'run':
    cmdRun(opts._[0]);
    break;
  default:
    console.log('usage: prodoljay.mjs schedule --at <time> [--cwd dir] [--effort level] [--safe] [--prompt-file path] | test [--cwd dir] | list [--all] | cancel <id|all>');
    process.exit(command ? 1 : 0);
}
