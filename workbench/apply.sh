#!/usr/bin/env bash
#
# Put the pingwin UI fonts into code-server's workbench.
#
# The colour theme and file icons install as a normal extension and survive
# upgrades. This part cannot: the UI font is hardcoded in VS Code's own
# workbench.css, so the only way in is a stylesheet linked from workbench.html —
# a file that lives inside the install tree and is replaced wholesale on every
# upgrade. Run this again afterwards.
#
#   ./workbench/apply.sh
#
# Idempotent. The <link> is tagged with a marker comment so a second run
# recognises its own work instead of stacking another copy.
#
# Override either path if your install lives somewhere unusual:
#   CODE_SERVER_PAGES=... CODE_SERVER_WORKBENCH=... ./workbench/apply.sh

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Find the install root: the Debian package path first, then standalone
# tarballs under $HOME, newest-extracted first — `code-server-4.9` and
# `code-server-4.145` sort the wrong way round alphabetically, so order by
# mtime rather than by name.
CS_ROOT=""
while IFS= read -r root; do
  if [[ -d $root/lib/vscode/out ]]; then
    CS_ROOT="$root"
    break
  fi
done < <(
  printf '%s\n' /usr/lib/code-server
  ls -td "$HOME/.local/lib/code-server-"* 2>/dev/null || true
)

PAGES="${CODE_SERVER_PAGES:-${CS_ROOT:+$CS_ROOT/src/browser/pages}}"
WORKBENCH="${CODE_SERVER_WORKBENCH:-${CS_ROOT:+$CS_ROOT/lib/vscode/out/vs/code/browser/workbench/workbench.html}}"

if [[ -z $PAGES || ! -d $PAGES ]]; then
  echo "error: could not find code-server's src/browser/pages" >&2
  echo "       set CODE_SERVER_PAGES=/path/to/src/browser/pages" >&2
  exit 1
fi
if [[ -z $WORKBENCH || ! -f $WORKBENCH ]]; then
  echo "error: could not find workbench.html" >&2
  echo "       set CODE_SERVER_WORKBENCH=/path/to/workbench.html" >&2
  exit 1
fi

# The Debian install tree is root-owned; the standalone tarball under $HOME is
# not. Only reach for sudo when the files actually need it.
SUDO=""
[[ -w $WORKBENCH && -w $PAGES ]] || SUDO=sudo
[[ $EUID -eq 0 ]] && SUDO=""

# ── assets ──────────────────────────────────────────────────────────────────
# The fonts go in flat beside the CSS because pingwin-workbench.css references
# them as ./x.woff2. If the login theme is also installed these are the same
# three files; installing them twice is harmless and keeps the two independent.
$SUDO install -m 0644 "$SRC/pingwin-workbench.css" "$PAGES/pingwin-workbench.css"
for f in "$SRC"/fonts/*.woff2; do
  $SUDO install -m 0644 "$f" "$PAGES/$(basename "$f")"
done
echo "installed stylesheet + fonts into $PAGES"

# ── the link ────────────────────────────────────────────────────────────────
MARKER="pingwin-workbench"

# Back up the genuine upstream file exactly once. A second run must never
# overwrite the .orig with an already-patched copy, or the original is gone.
if [[ ! -f "$WORKBENCH.orig" ]]; then
  $SUDO cp -p "$WORKBENCH" "$WORKBENCH.orig"
  echo "backed up workbench.html -> workbench.html.orig"
fi

if grep -q "$MARKER" "$WORKBENCH"; then
  echo "workbench.html already links the stylesheet — nothing to do"
else
  # {{BASE}}/_static/ is how workbench.html already addresses files in the
  # install tree (see its pwa-icon links), so this resolves wherever the
  # editor is mounted. Appending after workbench.css is the whole point: the
  # font rules win on source order, not on brute-force !important.
  LINK='    <link rel="stylesheet" href="{{BASE}}/_static/src/browser/pages/pingwin-workbench.css">'
  $SUDO perl -i -pe "s{(</head>)}{$LINK\n\$1}" "$WORKBENCH"
  grep -q "$MARKER" "$WORKBENCH" || { echo "error: injection failed" >&2; exit 1; }
  echo "linked pingwin-workbench.css from workbench.html"
fi

echo
echo "Restart code-server, then hard-reload the browser (cmd-shift-r)."
echo "workbench.html is cached aggressively; a soft reload will show the old fonts."
