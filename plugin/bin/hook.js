// @bun
// src/hook/entry.ts
import process4 from "process";

// src/hook/index.ts
import { Buffer } from "buffer";
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
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

// src/hook/map.ts
var HUMAN_TURN_ORIGINS = new Set(["human", "sdk"]);
var WAKE_UP_TURN_ORIGINS = new Set(["task_notification", "peer", "system", "scheduled"]);
function sessionName(cwd, branch) {
  const dir = cwd.split("/").filter(Boolean).pop() ?? cwd;
  return branch && branch !== "main" && branch !== "master" ? `${dir} \xB7 ${branch}` : dir;
}
function sessionInfo(input, env, git) {
  const project = env.OD_PROJECT_ID;
  if (project)
    return { id: input.session_id, name: project, harness: "open-design", project, cwd: input.cwd };
  const root = git.projectRoot(input.cwd);
  return { id: input.session_id, name: sessionName(root, git.readBranch(root)), harness: "claude-code", cwd: input.cwd };
}
function turnOpener(tail) {
  const lines = tail.split(`
`);
  for (let i = lines.length - 1;i >= 0; i--) {
    const line = lines[i];
    const opens = line.includes('"turnOrigin"');
    if (!opens && !line.includes(FEEDBACK_PREFIX))
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
    if (!opens || entry?.type !== "user" || typeof entry.turnOrigin !== "string")
      continue;
    if (isChannelFeedback(entry))
      return "human";
    if (isRewakeFeedback(entry))
      return "rewake";
    return HUMAN_TURN_ORIGINS.has(entry.turnOrigin) ? "human" : WAKE_UP_TURN_ORIGINS.has(entry.turnOrigin) ? "system" : "unknown";
  }
  return "unknown";
}
function isFeedbackDelivery(entry) {
  const attachment = entry?.type === "attachment" ? entry.attachment : undefined;
  return attachment?.type === "hook_additional_context" && Array.isArray(attachment.content) && attachment.content.some((c) => typeof c === "string" && c.startsWith(FEEDBACK_PREFIX));
}
function isChannelFeedback(entry) {
  return entry?.origin?.kind === "channel" && carriesFeedback(entry);
}
function isRewakeFeedback(entry) {
  return entry?.origin?.kind === "task-notification" && carriesFeedback(entry);
}
function carriesFeedback(entry) {
  const content = entry.message?.content;
  const texts = typeof content === "string" ? [content] : Array.isArray(content) ? content.map((c) => c?.text) : [];
  return texts.some((t) => typeof t === "string" && t.includes(FEEDBACK_PREFIX));
}
function mapHook(input, session, opener = "unknown") {
  switch (input.hook_event_name) {
    case "SessionStart":
      return { kind: "session", session };
    case "PostToolUse": {
      const images = extractImages(input.tool_response);
      if (images.length === 0)
        return null;
      const source = images.length === 1 ? imageSource(input.tool_input) : undefined;
      if (source)
        images[0].source = source;
      return { kind: "image", session, toolName: input.tool_name ?? "", images };
    }
    case "PreToolUse": {
      if (input.tool_name !== "AskUserQuestion")
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
    default:
      return null;
  }
}
var FEEDBACK_VIA = {
  PostToolUse: "post-tool-use",
  Stop: "stop",
  UserPromptSubmit: "user-prompt-submit"
};
function feedbackVia(hookEventName) {
  return FEEDBACK_VIA[hookEventName] ?? null;
}
function feedbackOutput(hookEventName, items) {
  if (items.length === 0 || !feedbackVia(hookEventName))
    return null;
  const text = feedbackText(items);
  return { hookSpecificOutput: { hookEventName, additionalContext: text } };
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
    for (const value of Object.values(node))
      visit(value, depth + 1);
  };
  visit(response, 0);
  return out;
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

// src/hook/index.ts
var POST_TIMEOUT_MS = 1500;
var TRANSCRIPT_TAIL_WINDOWS = [256 * 1024, 1024 * 1024, 4 * 1024 * 1024, 8 * 1024 * 1024];
async function runHook() {
  if (process2.env.GOLLABARA_HOOK === "off")
    return;
  try {
    const raw = await Bun.stdin.text();
    const input = JSON.parse(raw);
    const session = sessionInfo(input, { OD_PROJECT_ID: process2.env.OD_PROJECT_ID }, { projectRoot, readBranch });
    const opener = input.hook_event_name === "Stop" ? stopTurnOpener(input.transcript_path) : "unknown";
    const event = mapHook(input, session, opener);
    if (event?.kind === "session")
      event.pid = process2.ppid;
    const via = feedbackVia(input.hook_event_name);
    const signal = AbortSignal.timeout(POST_TIMEOUT_MS);
    const post = (path, body) => fetch(`${serverUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    const [, claimed] = await Promise.allSettled([
      event ? post("/api/events", event) : null,
      via ? post("/api/feedback/claim", { sessionId: session.id, via }).then((r) => r.ok ? r.json() : []) : []
    ]);
    const items = claimed.status === "fulfilled" && Array.isArray(claimed.value) ? claimed.value : [];
    const output = feedbackOutput(input.hook_event_name, items);
    if (output)
      await Bun.write(Bun.stdout, JSON.stringify(output));
  } catch {}
}
function stopTurnOpener(transcriptPath, windows = TRANSCRIPT_TAIL_WINDOWS) {
  if (!transcriptPath)
    return "unknown";
  for (const bytes of windows) {
    const tail = readTail(transcriptPath, bytes);
    if (!tail)
      return "unknown";
    const opener = turnOpener(tail.text);
    if (opener !== "unknown" || tail.whole)
      return opener;
  }
  return "unknown";
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
function projectRoot(cwd) {
  for (let dir = resolve(cwd);; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git")))
      return dir;
    if (dirname(dir) === dir)
      return cwd;
  }
}
function readBranch(root) {
  try {
    const dotGit = join(root, ".git");
    let gitDir = dotGit;
    if (statSync(dotGit).isFile()) {
      const line = readFileSync(dotGit, "utf8").trim();
      if (!line.startsWith("gitdir:"))
        return;
      gitDir = resolve(root, line.slice("gitdir:".length).trim());
    }
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
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
async function runWait() {
  if (process3.env.GOLLABARA_HOOK === "off")
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
        const res = await fetch(url, { signal: abort.signal });
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
process4.exit(process4.argv[2] === "wait" ? await runWait() : (await runHook(), 0));
