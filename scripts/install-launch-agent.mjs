#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const pluginRoot = resolve(new URL("..", import.meta.url).pathname);
const plistPath = join(homedir(), "Library", "LaunchAgents", "dev.agentclash.voice-standup.plist");
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.split("=")[1] : "standup";
const allowedModes = new Set(["standup", "control", "terminal-control"]);

if (!allowedModes.has(mode)) {
  throw new Error(`Unsupported mode '${mode}'. Use --mode=standup or --mode=control.`);
}

const runtimeArg = mode === "control" ? "--voice-control" : "--standup";
const runnerPath = mode === "terminal-control"
  ? join(pluginRoot, "scripts", "start-voice-control-terminal.sh")
  : join(pluginRoot, "scripts", "launch-agent-runner.sh");
const programArguments = mode === "terminal-control"
  ? `    <string>${runnerPath}</string>`
  : `    <string>${runnerPath}</string>
    <string>${runtimeArg}</string>`;

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.agentclash.voice-standup</string>
  <key>ProgramArguments</key>
  <array>
${programArguments}
  </array>
  <key>WorkingDirectory</key>
  <string>${pluginRoot}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(homedir(), "Library", "Logs", "voice-standup.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(homedir(), "Library", "Logs", "voice-standup.err.log")}</string>
</dict>
</plist>
`;

if (args.has("--print")) {
  console.log(plist);
} else {
  await mkdir(dirname(plistPath), { recursive: true });
  await writeFile(plistPath, plist);
  console.log(`Wrote ${plistPath}`);
  console.log(`Mode: ${mode}`);
  console.log(`Load it with: launchctl load "${plistPath}"`);
  console.log(`Reload it with: launchctl unload "${plistPath}" 2>/dev/null || true; launchctl load "${plistPath}"`);
}
