#!/usr/bin/env bash
# hook 입력(stdin JSON)을 그대로 남긴다. 세션 작업을 막지 않도록 항상 exit 0.
dir="${GOLLABARA_SPIKE_DIR:-$HOME/.gollabara/spike}"
mkdir -p "$dir"
input="$(cat)"
event="$(printf '%s' "$input" | jq -r '.hook_event_name // "unknown"' 2>/dev/null)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // ""' 2>/dev/null | tr '/:' '__')"
ts="$(date +%Y%m%d-%H%M%S)-$$"
printf '%s' "$input" > "$dir/$ts-$event${tool:+-$tool}.json"
exit 0
