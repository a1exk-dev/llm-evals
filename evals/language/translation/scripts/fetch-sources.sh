#!/usr/bin/env bash
# Downloads the pinned sources of the translation texts into .cache/.
set -euo pipefail

cache="$(cd "$(dirname "$0")/.." && pwd)/.cache"
mkdir -p "$cache"

# sparse_fetch <repo> <full sha> <dir> <path>...
sparse_fetch() {
  local repo=$1 sha=$2 dir="$cache/$3"
  shift 3
  if [ -d "$dir/.git" ] && [ "$(git -C "$dir" rev-parse HEAD)" = "$sha" ]; then
    return
  fi
  rm -rf "$dir"
  git init -q "$dir"
  git -C "$dir" remote add origin "https://github.com/$repo.git"
  git -C "$dir" sparse-checkout set --no-cone "$@"
  git -C "$dir" fetch -q --depth 1 --filter=blob:none origin "$sha"
  git -C "$dir" checkout -q FETCH_HEAD
}

sparse_fetch kubernetes/website de0990c2ae787ea164cde35f28b0e027700301db kubernetes \
  /content/en/docs/ /content/pl/docs/ /content/ru/docs/
sparse_fetch discourse/discourse e077161ff34dca5e53cacb4e16430516143d3c67 discourse \
  /config/locales/server.en.yml /config/locales/server.pl_PL.yml /config/locales/server.ru.yml
sparse_fetch ethereum/ethereum-org-website 2d07fa79832ae6cc7346e0d6f0e912ffe4e66b11 ethereum \
  /public/content/whitepaper/index.md \
  /public/content/translations/pl/whitepaper/index.md \
  /public/content/translations/ru/whitepaper/index.md

mkdir -p "$cache/wmt24pp" "$cache/cc-by-4.0"
for pair in en-pl_PL en-ru_RU; do
  [ -s "$cache/wmt24pp/$pair.jsonl" ] || curl -fsSL -o "$cache/wmt24pp/$pair.jsonl" \
    "https://huggingface.co/datasets/google/wmt24pp/resolve/main/$pair.jsonl"
done
for lang in en pl ru; do
  suffix=""
  [ "$lang" = en ] || suffix=".$lang"
  [ -s "$cache/cc-by-4.0/$lang.html" ] || curl -fsSL -o "$cache/cc-by-4.0/$lang.html" \
    "https://creativecommons.org/licenses/by/4.0/legalcode$suffix"
done

# The CC page and the WMT24++ files have no commit pin. These hashes detect a change.
sha256sum --check --quiet <<SUMS
$(cat "$(dirname "$0")/sources.sha256" | sed "s|  |  $cache/|")
SUMS
