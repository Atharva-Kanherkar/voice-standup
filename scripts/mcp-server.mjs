#!/usr/bin/env node
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const pluginRoot = fileURLToPath(new URL("..", import.meta.url));

async function runNodeScript(script, args = []) {
  const { stdout, stderr } = await execFileAsync("node", [`./scripts/${script}`, ...args], {
    cwd: pluginRoot,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

const server = new McpServer({
  name: "voice-standup",
  version: "0.1.0",
});

server.tool(
  "standup_context",
  "Collect local read-only context for a startup standup.",
  {},
  async () => ({
    content: [{ type: "text", text: await runNodeScript("collect-standup-context.mjs") }],
  }),
);

server.tool(
  "realtime_standup",
  "Generate a concise startup standup using the OpenAI Realtime API.",
  {},
  async () => ({
    content: [{ type: "text", text: await runNodeScript("voice-standup.mjs", ["--standup"]) }],
  }),
);

server.tool(
  "launch_agent_template",
  "Return the macOS LaunchAgent install command or plist preview.",
  { printOnly: z.boolean().default(true) },
  async ({ printOnly }) => ({
    content: [{
      type: "text",
      text: await runNodeScript("install-launch-agent.mjs", [printOnly ? "--print" : "--install"]),
    }],
  }),
);

await server.connect(new StdioServerTransport());
