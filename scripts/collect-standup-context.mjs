#!/usr/bin/env node
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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

const workspace = process.env.VOICE_STANDUP_WORKSPACE || defaultWorkspace();

async function run(command, args, options = {}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: workspace,
      timeout: options.timeout ?? 5000,
      maxBuffer: options.maxBuffer ?? 256 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    return `[unavailable: ${command} ${args.join(" ")}: ${error.message}]`;
  }
}

function readOptional(relativePath, maxChars = 4000) {
  const path = join(workspace, relativePath);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").slice(0, maxChars).trim();
}

const context = {
  generatedAt: new Date().toISOString(),
  workspace,
  project: basename(workspace),
  git: {
    branch: await run("git", ["branch", "--show-current"]),
    status: await run("git", ["status", "--short"]),
    recentCommits: await run("git", ["log", "--oneline", "-8"]),
  },
  docs: {
    readme: readOptional("README.md", 2500),
    agents: readOptional("AGENTS.md", 3500),
    todo: readOptional("TODO.md", 2500),
  },
};

console.log(JSON.stringify(context, null, 2));
