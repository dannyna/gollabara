#!/usr/bin/env bash
# 남긴 hook 데이터를 요약한다. 긴 문자열(base64 이미지 등)은 길이만 보인다.
dir="${GOLLABARA_SPIKE_DIR:-$HOME/.gollabara/spike}"
for f in "$dir"/*.json; do
  echo "== $(basename "$f")"
  jq -c 'walk(if type == "string" and length > 200 then "<\(length) chars: \(.[0:40])…>" else . end)' "$f"
done
