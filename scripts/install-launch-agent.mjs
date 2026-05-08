#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const pluginRoot = resolve(new URL("..", import.meta.url).pathname);
const plistPath = join(homedir(), "Library", "LaunchAgents", "dev.agentclash.voice-standup.plist");
const nodePath = process.execPath;

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.agentclash.voice-standup</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${join(pluginRoot, "scripts", "voice-standup.mjs")}</string>
    <string>--standup</string>
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
  console.log(`Load it with: launchctl load "${plistPath}"`);
}
