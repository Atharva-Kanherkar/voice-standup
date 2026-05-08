#!/usr/bin/env node
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { promisify } from "node:util";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);
const model = process.env.VOICE_STANDUP_MODEL || "gpt-realtime-2";
const voice = process.env.VOICE_STANDUP_VOICE || "marin";
const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
const args = new Set(process.argv.slice(2));
const pluginRoot = fileURLToPath(new URL("..", import.meta.url));

const SYSTEM_INSTRUCTIONS = `
You are a concise startup standup companion for a developer's desktop.
Give brief, useful answers in this structure when asked for standup:
1. Yesterday: what changed or what seems recently active.
2. Today: the likely highest-value next work.
3. Blockers: risks, missing information, or setup gaps.
4. First action: one concrete next command or task.

For desktop control requests, only suggest safe allowlisted actions.
Never ask to run arbitrary shell. Require confirmation before externally visible,
destructive, credential, install, purchase, or system-setting actions.
`.trim();

function requireApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }
}

function connectRealtime() {
  requireApiKey();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": process.env.OPENAI_SAFETY_IDENTIFIER || "local-voice-standup",
      },
    });

    ws.once("open", () => {
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: SYSTEM_INSTRUCTIONS,
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              turn_detection: { type: "semantic_vad" },
            },
            output: { voice },
          },
        },
      }));
      resolve(ws);
    });
    ws.once("error", reject);
  });
}

function sendUserText(ws, text) {
  ws.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    },
  }));
  ws.send(JSON.stringify({
    type: "response.create",
    response: { output_modalities: ["text"] },
  }));
}

function sendUserAudio(ws, audioBuffer) {
  ws.send(JSON.stringify({
    type: "input_audio_buffer.append",
    audio: audioBuffer.toString("base64"),
  }));
  ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  ws.send(JSON.stringify({
    type: "response.create",
    response: { output_modalities: ["text"] },
  }));
}

function sendAudioForIntent(ws, audioBuffer) {
  ws.send(JSON.stringify({
    type: "input_audio_buffer.append",
    audio: audioBuffer.toString("base64"),
  }));
  ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  ws.send(JSON.stringify({
    type: "response.create",
    response: {
      output_modalities: ["text"],
      instructions: `
Interpret the user's spoken command as exactly one JSON object and output no prose.
Allowed actions:
- {"action":"standup"}
- {"action":"open_app","app":"calendar|notes|reminders|terminal|safari|chrome|slack"}
- {"action":"git_status"}
- {"action":"quit"}
- {"action":"chat","message":"short answer to speak"}
- {"action":"unknown","message":"short clarification"}

Never invent shell commands. Never choose an action outside this schema.
`.trim(),
    },
  }));
}

function waitForTextResponse(ws) {
  return new Promise((resolve, reject) => {
    let text = "";
    const onMessage = (raw) => {
      const event = JSON.parse(raw.toString());
      if (event.type === "response.output_text.delta") {
        text += event.delta;
        output.write(event.delta);
      }
      if (event.type === "response.done") {
        output.write("\n");
        ws.off("message", onMessage);
        resolve(text.trim());
      }
      if (event.type === "error") {
        ws.off("message", onMessage);
        reject(new Error(event.error?.message || "Realtime API error"));
      }
    };
    ws.on("message", onMessage);
  });
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function collectStandupContext() {
  const { stdout } = await execFileAsync("node", ["./scripts/collect-standup-context.mjs"], {
    cwd: process.env.VOICE_STANDUP_PLUGIN_ROOT || pluginRoot,
    env: {
      ...process.env,
    },
    timeout: 8000,
    maxBuffer: 512 * 1024,
  });
  return stdout;
}

async function speak(text) {
  if (process.platform !== "darwin" || process.env.VOICE_STANDUP_SAY === "0") return;
  await execFileAsync("say", [text.slice(0, 3500)]).catch(() => {});
}

async function recordShortUtterance() {
  const seconds = process.env.VOICE_STANDUP_RECORD_SECONDS || "5";
  const timeout = (Number(seconds) + 5) * 1000;
  const candidates = [
    {
      command: "rec",
      label: "sox/rec",
      args: ["-q", "-b", "16", "-c", "1", "-r", "24000", "-e", "signed-integer", "-t", "raw", "-", "trim", "0", seconds],
    },
  ];

  if (process.platform === "darwin") {
    candidates.push({
      command: "ffmpeg",
      label: "ffmpeg avfoundation",
      args: [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "avfoundation",
        "-i",
        `:${process.env.VOICE_STANDUP_AUDIO_DEVICE || "0"}`,
        "-t",
        seconds,
        "-ac",
        "1",
        "-ar",
        "24000",
        "-f",
        "s16le",
        "pipe:1",
      ],
    });
  }

  const errors = [];
  for (const candidate of candidates) {
    try {
      console.log(`Recording ${seconds}s voice command with ${candidate.label}...`);
      const { stdout } = await execFileAsync(candidate.command, candidate.args, {
        encoding: "buffer",
        timeout,
        maxBuffer: 2 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`);
    }
  }
  throw new Error(`Could not record audio. Tried: ${errors.join("; ")}. On macOS, grant microphone permission to Terminal/VS Code or install sox with 'brew install sox'.`);
}

async function runStandup(ws) {
  const context = await collectStandupContext();
  sendUserText(ws, `Create my startup standup from this context:\n\n${context}`);
  const text = await waitForTextResponse(ws);
  await speak(text);
}

async function runAllowlistedLocalAction(command) {
  const normalized = command.trim().toLowerCase();
  const openApp = normalized.match(/^open (calendar|notes|reminders|terminal|safari|chrome|slack)$/);
  if (openApp && process.platform === "darwin") {
    const appName = openApp[1] === "chrome" ? "Google Chrome" : openApp[1][0].toUpperCase() + openApp[1].slice(1);
    await execFileAsync("open", ["-a", appName]);
    return `Opened ${appName}.`;
  }
  if (normalized === "git status") {
    const { stdout } = await execFileAsync("git", ["status", "--short"], { timeout: 5000 });
    return stdout.trim() || "Git tree is clean.";
  }
  return null;
}

async function runVoiceIntent(ws, intent) {
  if (!intent || typeof intent !== "object") {
    return "I could not understand that command.";
  }

  if (intent.action === "standup") {
    await runStandup(ws);
    return null;
  }

  if (intent.action === "open_app" && typeof intent.app === "string") {
    return runAllowlistedLocalAction(`open ${intent.app}`);
  }

  if (intent.action === "git_status") {
    return runAllowlistedLocalAction("git status");
  }

  if (intent.action === "quit") {
    return "__quit__";
  }

  if (intent.action === "chat" && typeof intent.message === "string") {
    return intent.message;
  }

  if (intent.action === "unknown" && typeof intent.message === "string") {
    return intent.message;
  }

  return "That command is not allowlisted yet.";
}

async function listenLoop(ws) {
  const rl = createInterface({ input, output });
  console.log("Voice Standup listening in text mode. Try: standup, open calendar, git status, quit");
  for (;;) {
    const line = await rl.question("> ");
    if (["quit", "exit"].includes(line.trim().toLowerCase())) break;
    if (line.trim().toLowerCase() === "standup") {
      await runStandup(ws);
      continue;
    }
    const localResult = await runAllowlistedLocalAction(line);
    if (localResult) {
      console.log(localResult);
      await speak(localResult);
      continue;
    }
    sendUserText(ws, line);
    const text = await waitForTextResponse(ws);
    await speak(text);
  }
  rl.close();
}

async function runVoiceOnce(ws) {
  const audio = await recordShortUtterance();
  sendUserAudio(ws, audio);
  const text = await waitForTextResponse(ws);
  await speak(text);
}

async function runVoiceControl(ws) {
  console.log("Voice control ready. Say: standup, open calendar, open notes, git status, or quit.");
  console.log("This records short commands instead of keeping a continuous hot mic.");

  for (;;) {
    const audio = await recordShortUtterance();
    sendAudioForIntent(ws, audio);
    const raw = await waitForTextResponse(ws);
    const intent = extractJsonObject(raw);
    const result = await runVoiceIntent(ws, intent);
    if (result === "__quit__") {
      await speak("Voice control stopped.");
      break;
    }
    if (result) {
      console.log(result);
      await speak(result);
    }
  }
}

if (args.has("--help") || (!args.has("--standup") && !args.has("--listen") && !args.has("--voice-once") && !args.has("--voice-control"))) {
  console.log("Usage: node scripts/voice-standup.mjs --standup|--listen|--voice-once|--voice-control");
  process.exit(0);
}

const ws = await connectRealtime();
try {
  if (args.has("--standup")) await runStandup(ws);
  if (args.has("--listen")) await listenLoop(ws);
  if (args.has("--voice-once")) await runVoiceOnce(ws);
  if (args.has("--voice-control")) await runVoiceControl(ws);
} finally {
  ws.close();
}
