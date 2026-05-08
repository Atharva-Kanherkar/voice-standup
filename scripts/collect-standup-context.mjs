#!/usr/bin/env node
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { opendir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const home = homedir();
const lookbackHours = Number(process.env.VOICE_STANDUP_LOOKBACK_HOURS || 24);
const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
const maxRepos = Number(process.env.VOICE_STANDUP_MAX_REPOS || 12);

const skipDirNames = new Set([
  ".Trash",
  ".cache",
  ".npm",
  ".rustup",
  ".cargo",
  ".venv",
  "Applications",
  "Library",
  "Movies",
  "Music",
  "Pictures",
  "node_modules",
  "dist",
  "build",
  "target",
  "vendor",
]);

function defaultWorkspace() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}

function defaultScanRoots() {
  const candidates = [
    defaultWorkspace(),
    join(home, "plugins"),
    join(home, ".gstack", "repos"),
    join(home, "Documents", "Codex"),
    join(home, "Documents", "New project"),
    home,
  ];
  return [...new Set(candidates.map((path) => resolve(path)).filter((path) => existsSync(path)))];
}

function scanRoots() {
  if (process.env.VOICE_STANDUP_SCAN_ROOTS) {
    return process.env.VOICE_STANDUP_SCAN_ROOTS
      .split(",")
      .map((entry) => resolve(entry.trim()))
      .filter(Boolean)
      .filter((path) => existsSync(path));
  }
  return defaultScanRoots();
}

async function run(command, args, options = {}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout ?? 5000,
      maxBuffer: options.maxBuffer ?? 512 * 1024,
      encoding: options.encoding ?? "utf8",
      env: process.env,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

function readOptional(repo, relativePath, maxChars = 2500) {
  const path = join(repo, relativePath);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").slice(0, maxChars).trim();
}

async function discoverRepos(root, maxDepth = 5) {
  const repos = new Set();

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await opendir(dir);
    } catch {
      return;
    }

    for await (const entry of entries) {
      if (!entry.isDirectory() && !entry.isFile()) continue;
      if (entry.name === ".git") {
        repos.add(dir);
        continue;
      }
      if (!entry.isDirectory()) continue;
      if (skipDirNames.has(entry.name)) continue;
      if (entry.name.startsWith(".") && ![".gstack", ".codex"].includes(entry.name)) continue;
      await walk(join(dir, entry.name), depth + 1);
    }
  }

  await walk(root, 0);
  return [...repos];
}

async function changedFilesSince(repo) {
  const files = await run("git", ["ls-files", "-m", "-o", "--exclude-standard"], { cwd: repo });
  if (!files) return [];
  return files
    .split("\n")
    .filter(Boolean)
    .map((file) => {
      try {
        const stat = statSync(join(repo, file));
        return { file, mtime: stat.mtime.toISOString() };
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && new Date(entry.mtime) >= since)
    .slice(0, 20);
}

async function repoSummary(repo) {
  const recentCommits = await run(
    "git",
    ["log", "--all", `--since=${since.toISOString()}`, "--date=iso", "--pretty=format:%h %ad %s", "-12"],
    { cwd: repo },
  );
  const status = await run("git", ["status", "--short"], { cwd: repo });
  const changedFiles = await changedFilesSince(repo);
  const lastCommitEpoch = await run("git", ["log", "-1", "--format=%ct"], { cwd: repo });
  const lastCommitAt = lastCommitEpoch ? new Date(Number(lastCommitEpoch) * 1000).toISOString() : null;

  return {
    name: basename(repo),
    path: repo,
    branch: await run("git", ["branch", "--show-current"], { cwd: repo }),
    lastCommitAt,
    recentCommits: recentCommits ? recentCommits.split("\n") : [],
    status: status ? status.split("\n").slice(0, 25) : [],
    changedFiles,
    docs: {
      readme: readOptional(repo, "README.md", 1800),
      agents: readOptional(repo, "AGENTS.md", 2200),
      todo: readOptional(repo, "TODO.md", 1800),
    },
  };
}

function repoHasRecentActivity(summary) {
  if (summary.changedFiles.length > 0) return true;
  if (summary.status.length > 0) return true;
  return summary.recentCommits.length > 0;
}

async function githubActivity() {
  const login = await run("gh", ["api", "user", "--jq", ".login"], { timeout: 5000 });
  if (!login) return { available: false, reason: "gh is not authenticated or unavailable", events: [] };

  const raw = await run("gh", ["api", `/users/${login}/events?per_page=100`], {
    timeout: 8000,
    maxBuffer: 1024 * 1024,
  });
  if (!raw) return { available: false, login, reason: "GitHub events unavailable", events: [] };

  try {
    const events = JSON.parse(raw)
      .filter((event) => new Date(event.created_at) >= since)
      .map((event) => ({
        type: event.type,
        repo: event.repo?.name,
        createdAt: event.created_at,
        action: event.payload?.action || null,
        ref: event.payload?.ref || event.payload?.pull_request?.head?.ref || null,
        title: event.payload?.pull_request?.title || event.payload?.issue?.title || null,
        commits: event.payload?.commits?.slice(0, 5).map((commit) => commit.message) || [],
      }))
      .slice(0, 40);
    return { available: true, login, events };
  } catch (error) {
    return { available: false, login, reason: error.message, events: [] };
  }
}

const discovered = new Set();
for (const root of scanRoots()) {
  for (const repo of await discoverRepos(root)) discovered.add(resolve(repo));
}

const summaries = [];
for (const repo of discovered) {
  const summary = await repoSummary(repo);
  if (repoHasRecentActivity(summary)) summaries.push(summary);
}

summaries.sort((a, b) => {
  const dirtyScore = (repo) => repo.changedFiles.length * 100 + repo.status.length * 10;
  const dirtyDelta = dirtyScore(b) - dirtyScore(a);
  if (dirtyDelta !== 0) return dirtyDelta;
  const aTime = Math.max(
    new Date(a.lastCommitAt || 0).getTime(),
    ...a.changedFiles.map((file) => new Date(file.mtime).getTime()),
  );
  const bTime = Math.max(
    new Date(b.lastCommitAt || 0).getTime(),
    ...b.changedFiles.map((file) => new Date(file.mtime).getTime()),
  );
  return bTime - aTime;
});

const context = {
  generatedAt: new Date().toISOString(),
  lookbackHours,
  scanRoots: scanRoots(),
  localActivity: summaries.slice(0, maxRepos),
  githubActivity: await githubActivity(),
  instructions: [
    "Summarize work across all detected projects, not just this plugin.",
    "Prioritize activity from the last lookback window.",
    "Call out uncertainty when GitHub only exposes public events or when a repo has dirty files but no commits.",
  ],
};

console.log(JSON.stringify(context, null, 2));
