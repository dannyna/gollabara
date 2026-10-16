// @bun
// src/hook/entry.ts
import process4 from "process";

// src/hook/core.ts
import { existsSync, readFileSync as readFileSync2, statSync as statSync2 } from "fs";
import { dirname, join as join3, resolve } from "path";
import process2 from "process";

// src/shared/config.ts
import { homedir } from "os";
import { join } from "path";
import process from "process";
var DEFAULT_PORT = 4747;
function serverPort() {
  return Number(process.env.GOLLABARA_PORT ?? DEFAULT_PORT);
}
function serverUrl() {
  return process.env.GOLLABARA_URL ?? `http://127.0.0.1:${serverPort()}`;
}
function dataDir() {
  return process.env.GOLLABARA_DATA ?? join(homedir(), ".gollabara", "data");
}
// plugin/.claude-plugin/plugin.json
var plugin_default = {
  name: "gollabara",
  version: "0.3.4",
  description: "Streams the screenshots, recaps, and questions a session produces to the gollabara stream"
};

// src/shared/version.ts
var PLUGIN_VERSION = plugin_default.version;
var HOOK_VERSION_HEADER = "x-gollabara-hook";
var HOOK_HARNESS_HEADER = "x-gollabara-harness";

// src/hook/health.ts
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync } from "fs";
import { join as join2 } from "path";
var HEALTH_FILE = "hook-health.jsonl";
var HEALTH_ROTATED = "hook-health.1.jsonl";
var HEALTH_MAX_BYTES = 128 * 1024;
function logHealth(dir, entry, max = HEALTH_MAX_BYTES) {
  try {
    const path = join2(dir, HEALTH_FILE);
    const line = `${JSON.stringify(entry)}
`;
    let size = 0;
    try {
      size = statSync(path).size;
    } catch {
      mkdirSync(dir, { recursive: true });
    }
    if (size && size + line.length > max)
      renameSync(path, join2(dir, HEALTH_ROTATED));
    appendFileSync(path, line);
  } catch {}
}
function errorClass(reason) {
  if (reason instanceof HttpError)
    return `http-${reason.status}`;
  const name = reason?.name;
  if (name === "TimeoutError" || name === "AbortError")
    return "timeout";
  const code = reason?.code;
  if (code === "ConnectionRefused" || code === "ECONNREFUSED")
    return "unreachable";
  return "error";
}

class HttpError extends Error {
  status;
  constructor(status) {
    super(`http ${status}`);
    this.status = status;
  }
}

// src/hook/map.ts
import { Buffer as Buffer2 } from "buffer";
import { isAbsolute } from "path";

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

// src/hook/transcript.ts
import { Buffer } from "buffer";
import { closeSync, fstatSync, openSync, readSync } from "fs";
var TRANSCRIPT_TAIL_WINDOWS = [256 * 1024, 1024 * 1024, 4 * 1024 * 1024, 8 * 1024 * 1024];
var TRANSCRIPT_HEAD_BYTES = 64 * 1024;
function fromTail(path, find, windows) {
  if (!path)
    return;
  for (const bytes of windows) {
    const tail = readTail(path, bytes);
    if (!tail)
      return;
    const found = find(tail.text);
    if (found !== undefined || tail.whole)
      return found;
  }
  return;
}
function readHead(path, bytes) {
  try {
    const fd = openSync(path, "r");
    try {
      const buffer = Buffer.alloc(Math.min(fstatSync(fd).size, bytes));
      readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return;
  }
}
function readTail(path, bytes) {
  try {
    const fd = openSync(path, "r");
    try {
      const size = fstatSync(fd).size;
      const length = Math.min(size, bytes);
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, size - length);
      return { text: buffer.toString("utf8"), whole: length === size };
    } finally {
      closeSync(fd);
    }
  } catch {
    return;
  }
}

// src/hook/claude-code.ts
var HUMAN_TURN_ORIGINS = new Set(["human", "sdk"]);
var WAKE_UP_TURN_ORIGINS = new Set(["task_notification", "peer", "system", "scheduled"]);
function turnOpener(tail) {
  const lines = tail.split(`
`);
  let typed = false;
  for (let i = lines.length - 1;i >= 0; i--) {
    const line = lines[i];
    const opens = line.includes('"turnOrigin"');
    const queued = line.includes('"queued_command"');
    if (!opens && !queued && !line.includes(FEEDBACK_PREFIX))
      continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.isSidechain)
      continue;
    if (isFeedbackDelivery(entry))
      return "human";
    if (queued && isHumanQueuedPrompt(entry))
      typed = true;
    if (!opens || entry?.type !== "user" || typeof entry.turnOrigin !== "string")
      continue;
    if (isRewakeFeedback(entry))
      return "rewake";
    if (HUMAN_TURN_ORIGINS.has(entry.turnOrigin))
      return "human";
    if (WAKE_UP_TURN_ORIGINS.has(entry.turnOrigin))
      return typed ? "human" : "system";
    return "unknown";
  }
  return "unknown";
}
function turnStartedAt(tail) {
  const lines = tail.split(`
`);
  for (let i = lines.length - 1;i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"turnOrigin"'))
      continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.isSidechain || entry?.type !== "user" || typeof entry.turnOrigin !== "string")
      continue;
    const at = Date.parse(entry.timestamp);
    return Number.isFinite(at) ? at : undefined;
  }
  return;
}
function stopTurnOpener(transcriptPath, windows = TRANSCRIPT_TAIL_WINDOWS) {
  return fromTail(transcriptPath, (text) => {
    const opener = turnOpener(text);
    return opener === "unknown" ? undefined : opener;
  }, windows) ?? "unknown";
}
function isFeedbackDelivery(entry) {
  const attachment = entry?.type === "attachment" ? entry.attachment : undefined;
  return attachment?.type === "hook_additional_context" && Array.isArray(attachment.content) && attachment.content.some((c) => typeof c === "string" && c.startsWith(FEEDBACK_PREFIX));
}
function isHumanQueuedPrompt(entry) {
  const attachment = entry?.type === "attachment" ? entry.attachment : undefined;
  return attachment?.type === "queued_command" && attachment.origin?.kind === "human";
}
function isRewakeFeedback(entry) {
  return entry?.origin?.kind === "task-notification" && carriesFeedback(entry);
}
function carriesFeedback(entry) {
  const content = entry.message?.content;
  const texts = typeof content === "string" ? [content] : Array.isArray(content) ? content.map((c) => c?.text) : [];
  return texts.some((t) => typeof t === "string" && t.includes(FEEDBACK_PREFIX));
}
var claudeCode = {
  project: (env) => env.OD_PROJECT_ID,
  stopOpener: (transcriptPath) => stopTurnOpener(transcriptPath),
  turnStartedAt,
  claims: () => true,
  output: (hookEventName, text) => ({ hookSpecificOutput: { hookEventName, additionalContext: text } })
};

// src/hook/codex.ts
function codexTurnStartedAt(tail) {
  const lines = tail.split(`
`);
  for (let i = lines.length - 1;i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"task_started"'))
      continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "event_msg" || entry.payload?.type !== "task_started")
      continue;
    const at = Date.parse(entry.timestamp);
    return Number.isFinite(at) ? at : undefined;
  }
  return;
}
var codex = {
  project: () => {
    return;
  },
  stopOpener: () => "unknown",
  turnStartedAt: codexTurnStartedAt,
  claims: (hookEventName, input) => !(hookEventName === "Stop" && input?.stop_hook_active),
  output: (hookEventName, text) => hookEventName === "Stop" ? { decision: "block", reason: text } : { hookSpecificOutput: { hookEventName, additionalContext: text } }
};

// src/hook/map.ts
var ADAPTERS = { "claude-code": claudeCode, codex };
var QUESTION_TOOLS = new Set(["AskUserQuestion", "request_user_input"]);
var SESSION_START_REASONS = ["startup", "resume", "clear", "compact"];
function sessionName(cwd, branch) {
  const dir = cwd.split("/").filter(Boolean).pop() ?? cwd;
  return branch && branch !== "main" && branch !== "master" ? `${dir} \xB7 ${branch}` : dir;
}
function sessionInfo(input, env, git, adapter = "claude-code") {
  const project = ADAPTERS[adapter].project(env);
  if (project)
    return { id: input.session_id, name: project, harness: "open-design", project, cwd: input.cwd };
  const root = git.projectRoot(input.cwd);
  return { id: input.session_id, name: sessionName(root, git.readBranch(root)), harness: adapter, cwd: input.cwd };
}
function sessionStartedAt(head) {
  for (const line of head.split(`
`)) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const at = typeof entry?.timestamp === "string" ? Date.parse(entry.timestamp) : Number.NaN;
    if (Number.isFinite(at))
      return at;
  }
  return;
}
function imageRole(mtimeMs, startedAt) {
  if (mtimeMs === undefined || startedAt === undefined)
    return "artifact";
  return mtimeMs > startedAt ? "artifact" : "reference";
}
function readFilePath(toolInput) {
  const path = imageSource(toolInput);
  return path && isAbsolute(path) ? path : undefined;
}
function mapHook(input, session, opener = "unknown", fileRole) {
  switch (input.hook_event_name) {
    case "SessionStart": {
      const reason = SESSION_START_REASONS.find((r) => r === input.source);
      return reason ? { kind: "session", session, reason } : { kind: "session", session };
    }
    case "PostToolUse": {
      const images = extractImages(input.tool_response);
      if (images.length === 0)
        return null;
      const source = images.length === 1 ? imageSource(input.tool_input) : undefined;
      if (source)
        images[0].source = source;
      const path = input.tool_name?.startsWith("mcp__") ? undefined : readFilePath(input.tool_input);
      const role = path && fileRole ? fileRole(path) : "artifact";
      for (const image of images)
        image.role = role;
      return { kind: "image", session, toolName: input.tool_name ?? "", images };
    }
    case "PreToolUse": {
      if (!QUESTION_TOOLS.has(input.tool_name ?? ""))
        return null;
      const questions = extractQuestions(input.tool_input);
      return questions.length ? { kind: "question", session, questions } : null;
    }
    case "Stop": {
      if (opener === "system" && !input.stop_hook_active)
        return null;
      const text = recapOf(input.last_assistant_message);
      if (!text)
        return null;
      return input.stop_hook_active && opener !== "rewake" ? { kind: "recap", session, text, continuation: true } : { kind: "recap", session, text };
    }
    case "SessionEnd":
      return { kind: "session-end", session };
    default:
      return null;
  }
}
var FEEDBACK_VIA = {
  PostToolUse: "post-tool-use",
  Stop: "stop",
  UserPromptSubmit: "user-prompt-submit"
};
function feedbackVia(hookEventName, input, adapter = "claude-code") {
  if (!ADAPTERS[adapter].claims(hookEventName, input))
    return null;
  return FEEDBACK_VIA[hookEventName] ?? null;
}
function feedbackOutput(hookEventName, items, adapter = "claude-code") {
  if (items.length === 0 || !FEEDBACK_VIA[hookEventName])
    return null;
  return ADAPTERS[adapter].output(hookEventName, feedbackText(items));
}
function recapOf(message) {
  if (!message)
    return null;
  const line = message.split(`
`).map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/[*`]/g, "").trim()).find((l) => l.length > 0);
  return line || null;
}
function extractImages(response) {
  const out = [];
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6)
      return;
    if (Array.isArray(node)) {
      for (const child of node)
        visit(child, depth + 1);
      return;
    }
    if (node.type === "image" && node.file?.base64) {
      const d = node.file.dimensions ?? {};
      out.push({
        data: node.file.base64,
        mime: node.file.type ?? "image/png",
        width: d.originalWidth ?? d.displayWidth,
        height: d.originalHeight ?? d.displayHeight
      });
      return;
    }
    if (node.type === "image" && typeof node.data === "string") {
      out.push({ data: node.data, mime: node.mimeType ?? node.mime_type ?? "image/png" });
      return;
    }
    if (node.type === "image" && node.source?.type === "base64") {
      out.push({ data: node.source.data, mime: node.source.media_type ?? "image/png" });
      return;
    }
    if (node.type === "input_image" && typeof node.image_url === "string") {
      const image = dataUrlImage(node.image_url);
      if (image)
        out.push(image);
      return;
    }
    for (const value of Object.values(node))
      visit(value, depth + 1);
  };
  visit(response, 0);
  return out;
}
function dataUrlImage(url) {
  const match = /^data:([^;,]*)((?:;[^;,]*)*),/.exec(url);
  if (!match || !match[2].split(";").includes("base64"))
    return null;
  const data = url.slice(match[0].length);
  const mime = match[1].toLowerCase().startsWith("image/") ? match[1].toLowerCase() : sniffImageMime(data);
  return mime ? { data, mime } : null;
}
function sniffImageMime(base64) {
  const head = Buffer2.from(base64.slice(0, 24), "base64");
  const ascii = (from, to) => head.subarray(from, to).toString("latin1");
  if (head[0] === 137 && ascii(1, 4) === "PNG")
    return "image/png";
  if (head[0] === 255 && head[1] === 216 && head[2] === 255)
    return "image/jpeg";
  if (ascii(0, 4) === "GIF8")
    return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return "image/webp";
  return;
}
function imageSource(toolInput) {
  for (const key of ["file_path", "path", "filename"]) {
    const value = toolInput?.[key];
    if (typeof value === "string" && value.trim())
      return value.trim();
  }
  return;
}
function extractQuestions(toolInput) {
  const list = Array.isArray(toolInput?.questions) ? toolInput.questions : [];
  return list.filter((q) => typeof q?.question === "string").map((q) => ({
    question: q.question,
    header: q.header,
    multiSelect: q.multiSelect,
    options: Array.isArray(q.options) ? q.options.map((o) => ({ label: String(o?.label ?? ""), description: o?.description })) : []
  }));
}

// src/hook/core.ts
var HARD_DEADLINE_MS = 2500;
var POST_TIMEOUT_MS = 1500;
var SESSION_END_DEADLINE_MS = 1000;
var SESSION_END_POST_TIMEOUT_MS = 750;
function exitAt(ms) {
  setTimeout(() => process2.exit(0), Math.max(0, ms - performance.now())).unref();
}
async function runHook(adapter = "claude-code") {
  if (process2.env.GOLLABARA_HOOK === "off")
    return;
  const started = performance.now();
  let health;
  try {
    const raw = await Bun.stdin.text();
    const input = JSON.parse(raw);
    const ending = input.hook_event_name === "SessionEnd";
    if (ending)
      exitAt(SESSION_END_DEADLINE_MS);
    const session = sessionInfo(input, { OD_PROJECT_ID: process2.env.OD_PROJECT_ID }, { projectRoot, readBranch }, adapter);
    health = { event: input.hook_event_name, harness: session.harness, ms: 0 };
    const opener = input.hook_event_name === "Stop" ? ADAPTERS[adapter].stopOpener(input.transcript_path) : "unknown";
    const event = mapHook(input, session, opener, (path) => readFileRole(path, input.transcript_path, TRANSCRIPT_TAIL_WINDOWS, adapter));
    if (event?.kind === "session")
      event.pid = process2.ppid;
    const via = feedbackVia(input.hook_event_name, input, adapter);
    const signal = AbortSignal.timeout(ending ? SESSION_END_POST_TIMEOUT_MS : POST_TIMEOUT_MS);
    const post = (path, body) => fetch(`${serverUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", [HOOK_VERSION_HEADER]: PLUGIN_VERSION, [HOOK_HARNESS_HEADER]: session.harness },
      body: JSON.stringify(body),
      signal
    }).then((r) => {
      if (!r.ok)
        throw new HttpError(r.status);
      return r;
    });
    const results = await Promise.allSettled([
      event ? post("/api/events", event) : null,
      via ? post("/api/feedback/claim", { sessionId: session.id, via }).then((r) => r.json()) : []
    ]);
    if (event || via) {
      const failed = results.find((r) => r.status === "rejected");
      health = { ...health, ms: Math.round(performance.now() - started), ...failed ? { error: errorClass(failed.reason) } : {} };
    } else {
      health = undefined;
    }
    const claimed = results[1];
    const items = claimed.status === "fulfilled" && Array.isArray(claimed.value) ? claimed.value : [];
    const output = feedbackOutput(input.hook_event_name, items, adapter);
    if (output)
      await Bun.write(Bun.stdout, JSON.stringify(output));
  } catch {
    health = { event: health?.event ?? "unknown", harness: health?.harness, ms: Math.round(performance.now() - started), error: "error" };
  }
  if (health)
    logHealth(dataDir(), { at: Date.now(), ...health, ok: !health.error });
}
function turnStart(transcriptPath, windows = TRANSCRIPT_TAIL_WINDOWS, adapter = "claude-code") {
  const opened = fromTail(transcriptPath, ADAPTERS[adapter].turnStartedAt, windows);
  if (opened !== undefined || !transcriptPath)
    return opened;
  const head = readHead(transcriptPath, TRANSCRIPT_HEAD_BYTES);
  return head === undefined ? undefined : sessionStartedAt(head);
}
function readFileRole(path, transcriptPath, windows = TRANSCRIPT_TAIL_WINDOWS, adapter = "claude-code") {
  try {
    return imageRole(statSync2(path).mtimeMs, turnStart(transcriptPath, windows, adapter));
  } catch {
    return "artifact";
  }
}
function projectRoot(cwd) {
  for (let dir = resolve(cwd);; dir = dirname(dir)) {
    if (existsSync(join3(dir, ".git")))
      return dir;
    if (dirname(dir) === dir)
      return cwd;
  }
}
function readBranch(root) {
  try {
    const dotGit = join3(root, ".git");
    let gitDir = dotGit;
    if (statSync2(dotGit).isFile()) {
      const line = readFileSync2(dotGit, "utf8").trim();
      if (!line.startsWith("gitdir:"))
        return;
      gitDir = resolve(root, line.slice("gitdir:".length).trim());
    }
    const head = readFileSync2(join3(gitDir, "HEAD"), "utf8").trim();
    return head.startsWith("ref: refs/heads/") ? head.slice("ref: refs/heads/".length) : undefined;
  } catch {
    return;
  }
}

// src/hook/wait.ts
import process3 from "process";
var WAIT_BUDGET_MS = (86400 - 600) * 1000;
var POLL_TIMEOUT_MS = 35000;
var DOWN_RETRIES = 3;
var DOWN_RETRY_MS = 1e4;
async function waitForFeedback(poll, options) {
  const { deadline, now = Date.now, sleep = Bun.sleep, alive = () => true } = options;
  let down = 0;
  while (alive() && now() + POLL_TIMEOUT_MS < deadline) {
    const result = await poll();
    if (result === "stop")
      return null;
    if (result === "down") {
      if (++down > DOWN_RETRIES)
        return null;
      await sleep(DOWN_RETRY_MS);
      continue;
    }
    down = 0;
    if (result.items.length)
      return result.items;
  }
  return null;
}
function headless(entrypoint) {
  return entrypoint?.startsWith("sdk-") ?? false;
}
async function runWait() {
  if (process3.env.GOLLABARA_HOOK === "off" || headless(process3.env.CLAUDE_CODE_ENTRYPOINT))
    return 0;
  try {
    const input = JSON.parse(await Bun.stdin.text());
    if (!input.session_id)
      return 0;
    const pid = process3.ppid;
    const alive = () => process3.ppid === pid;
    const waiter = performance.timeOrigin;
    const url = `${serverUrl()}/api/channel/wait?${new URLSearchParams({ session: input.session_id, pid: String(pid), waiter: String(waiter) })}`;
    const poll = async () => {
      const abort = new AbortController;
      const timer = setTimeout(() => abort.abort(), POLL_TIMEOUT_MS);
      const watch = setInterval(() => alive() || abort.abort(), 1000);
      try {
        const res = await fetch(url, { signal: abort.signal, headers: { [HOOK_VERSION_HEADER]: PLUGIN_VERSION } });
        if (res.ok)
          return { items: await res.json() };
        return res.status >= 500 ? "down" : "stop";
      } catch {
        return alive() ? "down" : "stop";
      } finally {
        clearTimeout(timer);
        clearInterval(watch);
      }
    };
    const items = await waitForFeedback(poll, { deadline: Date.now() + WAIT_BUDGET_MS, alive });
    if (!items?.length)
      return 0;
    await Bun.write(Bun.stderr, feedbackText(items));
    return 2;
  } catch {
    return 0;
  }
}

// src/hook/entry.ts
var mode = process4.argv[2];
if (mode !== "wait")
  exitAt(mode === "session-end" ? SESSION_END_DEADLINE_MS : HARD_DEADLINE_MS);
process4.exit(mode === "wait" ? await runWait() : (await runHook(mode === "codex" ? "codex" : "claude-code"), 0));
