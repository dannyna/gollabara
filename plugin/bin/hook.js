// @bun
// src/hook/entry.ts
import process3 from "process";

// src/hook/index.ts
import { readFileSync } from "fs";
import { join } from "path";
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

// src/hook/map.ts
var RECAP_MAX = 160;
function sessionName(cwd, branch) {
  const dir = cwd.split("/").filter(Boolean).pop() ?? cwd;
  return branch && branch !== "main" && branch !== "master" ? `${dir} \xB7 ${branch}` : dir;
}
function sessionInfo(input, env, readBranch) {
  const project = env.OD_PROJECT_ID;
  if (project)
    return { id: input.session_id, name: project, harness: "open-design", project, cwd: input.cwd };
  return { id: input.session_id, name: sessionName(input.cwd, readBranch(input.cwd)), harness: "claude-code", cwd: input.cwd };
}
function mapHook(input, session) {
  switch (input.hook_event_name) {
    case "SessionStart":
      return { kind: "session", session };
    case "PostToolUse": {
      const images = extractImages(input.tool_response);
      if (images.length === 0)
        return null;
      return { kind: "image", session, toolName: input.tool_name ?? "", images };
    }
    case "PreToolUse": {
      if (input.tool_name !== "AskUserQuestion")
        return null;
      const questions = extractQuestions(input.tool_input);
      return questions.length ? { kind: "question", session, questions } : null;
    }
    case "Stop": {
      const text = recapOf(input.last_assistant_message);
      if (!text)
        return null;
      return input.stop_hook_active ? { kind: "recap", session, text, continuation: true } : { kind: "recap", session, text };
    }
    default:
      return null;
  }
}
function recapOf(message) {
  if (!message)
    return null;
  const line = message.split(`
`).map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/[*`]/g, "").trim()).find((l) => l.length > 0);
  if (!line)
    return null;
  return line.length > RECAP_MAX ? `${line.slice(0, RECAP_MAX - 1)}\u2026` : line;
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
async function runHook() {
  try {
    const raw = await Bun.stdin.text();
    const input = JSON.parse(raw);
    const session = sessionInfo(input, { OD_PROJECT_ID: process2.env.OD_PROJECT_ID }, readBranch);
    const event = mapHook(input, session);
    if (!event)
      return;
    await fetch(`${serverUrl()}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS)
    });
  } catch {}
}
function readBranch(cwd) {
  try {
    const head = readFileSync(join(cwd, ".git", "HEAD"), "utf8").trim();
    return head.startsWith("ref: refs/heads/") ? head.slice("ref: refs/heads/".length) : undefined;
  } catch {
    return;
  }
}

// src/hook/entry.ts
await runHook();
process3.exit(0);
