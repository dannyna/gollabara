// @bun
// src/channel/index.ts
import process2 from "process";

// src/shared/config.ts
import process from "process";
var DEFAULT_PORT = 4747;
function serverPort() {
  return Number(process.env.GOLLABARA_PORT ?? DEFAULT_PORT);
}
function serverUrl() {
  return process.env.GOLLABARA_URL ?? `http://127.0.0.1:${serverPort()}`;
}

// src/shared/feedback.ts
var FEEDBACK_PREFIX = "[gollabara] Feedback from the user";
function feedbackLine(item) {
  const about = item.image ? `, about the image ${item.image.path} captured ${clock(item.image.at)}${item.image.sessionName ? ` in ${item.image.sessionName}` : ""}` : "";
  return `${FEEDBACK_PREFIX} while you work (sent ${clock(item.createdAt)}${about}): ${item.text}`;
}
function feedbackText(items) {
  return items.map(feedbackLine).join(`
`);
}
function clock(at) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// src/channel/protocol.ts
var PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
var PLUGIN = "gollabara";
var CHANNEL_FLAGS = ["--channels", "--dangerously-load-development-channels"];
var INSTRUCTIONS = "Messages on this channel come from gollabara, the viewer where the user watches this " + "session's screenshots and recaps. Each one is the user's own feedback, relayed as written, and starts with " + '"[gollabara] Feedback from the user". Treat it as the user talking to you and act on it. The channel is one-way: ' + "answer in this session; there is nothing to send back.";
function respond(message) {
  const m = message;
  if (!m || typeof m !== "object" || typeof m.method !== "string" || m.id === undefined || m.id === null)
    return null;
  if (m.method === "initialize") {
    const asked = m.params?.protocolVersion;
    return {
      jsonrpc: "2.0",
      id: m.id,
      result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { experimental: { "claude/channel": {} } },
        serverInfo: { name: PLUGIN, version: "0.1.0" },
        instructions: INSTRUCTIONS
      }
    };
  }
  if (m.method === "ping")
    return { jsonrpc: "2.0", id: m.id, result: {} };
  return { jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } };
}
function feedbackNotification(items) {
  return {
    jsonrpc: "2.0",
    method: "notifications/claude/channel",
    params: { content: feedbackText(items), meta: { from: "gollabara" } }
  };
}
function channelEnabled(parentArgs) {
  const args = parentArgs.trim().split(/\s+/);
  if (args.includes("-p") || args.includes("--print"))
    return false;
  for (let i = 0;i < args.length; i++) {
    const [flag, inline] = args[i].split("=", 2);
    if (!CHANNEL_FLAGS.includes(flag))
      continue;
    const values = inline !== undefined ? [inline] : [];
    if (inline === undefined) {
      for (let j = i + 1;j < args.length && !args[j].startsWith("-"); j++)
        values.push(args[j]);
    }
    if (values.some((v) => v.startsWith(`plugin:${PLUGIN}@`)))
      return true;
  }
  return false;
}

// src/channel/index.ts
var POLL_TIMEOUT_MS = 35000;
var UNLINKED_RETRY_MS = 2000;
var ERROR_RETRY_MS = 1e4;
function runChannel() {
  const pid = process2.ppid;
  const enabled = process2.env.GOLLABARA_HOOK !== "off" && channelEnabled(parentArgs(pid));
  let polling = false;
  console.error(enabled ? "gollabara channel: on" : "gollabara channel: off (Claude Code was not started with this plugin as a channel)");
  process2.stdin.on("end", () => process2.exit(0));
  process2.stdin.on("close", () => process2.exit(0));
  process2.stdout.on("error", () => process2.exit(0));
  let buffer = "";
  process2.stdin.setEncoding("utf8");
  process2.stdin.on("data", (chunk) => {
    buffer += chunk;
    for (let i = buffer.indexOf(`
`);i >= 0; i = buffer.indexOf(`
`)) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!line)
        continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const reply = respond(message);
      if (reply)
        write(reply);
      if (message?.method === "notifications/initialized" && enabled && !polling) {
        polling = true;
        poll(pid);
      }
    }
  });
}
async function poll(pid) {
  for (;; ) {
    if (process2.ppid !== pid)
      process2.exit(0);
    let wait = 0;
    try {
      const res = await fetch(`${serverUrl()}/api/channel/wait?pid=${pid}`, { signal: AbortSignal.timeout(POLL_TIMEOUT_MS) });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length)
          write(feedbackNotification(items));
      } else {
        wait = res.status === 404 ? UNLINKED_RETRY_MS : ERROR_RETRY_MS;
      }
    } catch {
      wait = ERROR_RETRY_MS;
    }
    if (wait)
      await Bun.sleep(wait);
  }
}
function write(frame) {
  try {
    process2.stdout.write(`${JSON.stringify(frame)}
`);
  } catch {
    process2.exit(0);
  }
}
function parentArgs(pid) {
  try {
    return Bun.spawnSync(["ps", "-o", "args=", "-p", String(pid)]).stdout.toString();
  } catch {
    return "";
  }
}

// src/channel/entry.ts
runChannel();
