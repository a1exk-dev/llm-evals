#!/usr/bin/env bash
# Writes tests/chrf-values.json: the sacreBLEU corpus chrF++ of each case in
# tests/chrf-cases.json. Run it only to change the cases. The eval itself needs
# no Python: chrf.test.ts reads the fixed values.
set -euo pipefail
cd "$(dirname "$0")"
SACREBLEU_VERSION=2.5.1
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
echo "{" > chrf-values.json
n=$(jq length chrf-cases.json)
for ((i = 0; i < n; i++)); do
  id=$(jq -r ".[$i].id" chrf-cases.json)
  jq -r ".[$i].hyp[]" chrf-cases.json > "$work/hyp"
  jq -r ".[$i].ref[]" chrf-cases.json > "$work/ref"
  score=$(uvx --from "sacrebleu==$SACREBLEU_VERSION" sacrebleu "$work/ref" -i "$work/hyp" \
    -m chrf --chrf-word-order 2 -b -w 6)
  sep=","; [[ $i -eq $((n - 1)) ]] && sep=""
  echo "  \"$id\": $score$sep" >> chrf-values.json
done
echo "}" >> chrf-values.json
echo "sacrebleu $SACREBLEU_VERSION: $n values" >&2
