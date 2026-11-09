#!/usr/bin/env node
// Generates fileicons/icons/*.svg and fileicons/pingwin-icon-theme.json.
//
// Why a generator and not twenty hand-written files: pingwin's icon contract is
// a single rule — 24-unit grid, fill none, 2px stroke, round caps and joins —
// and a rule that lives in twenty files is a rule that drifts. Here it is one
// constant, applied once.
//
// The colours have to be *baked*. VS Code renders file-icon SVGs as <img>, so
// `currentColor` resolves against nothing and the glyph disappears. That is the
// one place this theme departs from pingwin's web/Android icons, which inherit.
//
//   npm run icons

import { mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(root, "fileicons", "icons");

// ─── palette ────────────────────────────────────────────────────────────────
// Pingwin's rule: one warm amber accent, everything else on the grey ramp.
// Folders get the amber because the tree's *structure* is the chrome; files are
// content and stay quiet. Three tiers of quiet, brightest = the house language.
const AMBER = "#f2a33c"; // --amber      structure
const TEXT = "#d7e0e7"; // --text       TypeScript, the language this shop writes
const MUTED = "#71838f"; // --muted      a language or format worth naming
const FAINT = "#55666f"; // --faint      generic and machine-owned files

// ─── glyphs ─────────────────────────────────────────────────────────────────
// Each entry is the inner markup of a 24×24 SVG. Stroke colour comes from the
// wrapper; anything that needs a solid dot sets fill="{C}" explicitly, since
// the wrapper sets fill="none" for the strokes.
const glyphs = {
  // page with a folded corner — the honest default
  file: [
    `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>`,
    `<path d="M14 3v5h5"/>`,
  ],

  folder: [
    `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  ],
  // lid tilted forward, so open/closed reads without the twisty arrow
  "folder-open": [
    `<path d="M4 19V7a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v2"/>`,
    `<path d="M4 19l2.5-7H22l-2.5 7z"/>`,
  ],
  // workspace root wears the tower beacon
  root: [
    `<path d="M3 8a2 2 0 0 1 2-2h4l2 2h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
    `<circle cx="19.5" cy="4.5" r="2" fill="{C}" stroke="none"/>`,
  ],
  "root-open": [
    `<path d="M4 19V8a2 2 0 0 1 2-2h3.5l2 2H17a2 2 0 0 1 2 2v1"/>`,
    `<path d="M4 19l2.5-7H22l-2.5 7z"/>`,
    `<circle cx="20" cy="4" r="2" fill="{C}" stroke="none"/>`,
  ],

  // { } — a type system is a shape you declare
  braces: [
    `<path d="M10 4H9a2.5 2.5 0 0 0-2.5 2.5v3A2.5 2.5 0 0 1 4 12a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 0 9 20h1"/>`,
    `<path d="M14 4h1a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 0 20 12a2.5 2.5 0 0 0-2.5 2.5v3A2.5 2.5 0 0 1 15 20h-1"/>`,
  ],
  // </>
  angle: [
    `<path d="M9 8l-4.5 4L9 16"/>`,
    `<path d="M15 8l4.5 4L15 16"/>`,
    `<path d="M13 5l-2 14"/>`,
  ],
  // orbits — JSX, a component with things in flight around it
  atom: [
    `<circle cx="12" cy="12" r="2" fill="{C}" stroke="none"/>`,
    `<ellipse cx="12" cy="12" rx="9.5" ry="4" />`,
    `<ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)"/>`,
    `<ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(120 12 12)"/>`,
  ],
  // [ · ] — structured data, bracketed and indexed
  brackets: [
    `<path d="M9 4H5v16h4"/>`,
    `<path d="M15 4h4v16h-4"/>`,
    `<circle cx="12" cy="12" r="1.4" fill="{C}" stroke="none"/>`,
  ],
  // indented key/value pairs — YAML's whole personality is the indent
  rows: [
    `<path d="M4 6.5h3"/>`,
    `<path d="M10 6.5h10"/>`,
    `<path d="M7 12h3"/>`,
    `<path d="M13 12h7"/>`,
    `<path d="M7 17.5h3"/>`,
    `<path d="M13 17.5h7"/>`,
  ],
  // prose
  lines: [`<path d="M4 6.5h16"/>`, `<path d="M4 12h16"/>`, `<path d="M4 17.5h10"/>`],
  // #
  hash: [
    `<path d="M10 4L8 20"/>`,
    `<path d="M17 4l-2 16"/>`,
    `<path d="M4 9.5h16"/>`,
    `<path d="M3.5 14.5h16"/>`,
  ],
  // a page split into regions — markup is layout
  layout: [
    `<rect x="4" y="5" width="16" height="14" rx="2"/>`,
    `<path d="M4 10h16"/>`,
    `<path d="M10 10v9"/>`,
  ],
  // the Elixir drop
  droplet: [
    `<path d="M12 3s6.5 6.4 6.5 10.5a6.5 6.5 0 0 1-13 0C5.5 9.4 12 3 12 3z"/>`,
  ],
  // K
  wedge: [`<path d="M6.5 4v16"/>`, `<path d="M6.5 12l7-8"/>`, `<path d="M6.5 12l7 8"/>`],
  // a prompt waiting for you
  prompt: [`<path d="M5 7.5l4.5 4.5L5 16.5"/>`, `<path d="M12.5 16.5H19"/>`],
  framed: [
    `<rect x="4" y="5" width="16" height="14" rx="2"/>`,
    `<circle cx="9" cy="10" r="1.6"/>`,
    `<path d="M4.5 17.5l4.5-4.5 3.5 3.5L16 13l4 4"/>`,
  ],
  // a pen path with its anchor points showing — vector, not raster.
  // Square anchors, because round ones just read as a thick-ended line.
  curve: [
    `<path d="M5 18.5C5.5 11 10.5 5.5 19 5.5"/>`,
    `<rect x="2" y="16" width="5" height="5" rx="1"/>`,
    `<rect x="17" y="3" width="5" height="5" rx="1"/>`,
  ],
  lock: [
    `<rect x="5" y="11" width="14" height="9.5" rx="2"/>`,
    `<path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"/>`,
  ],
  key: [
    `<circle cx="8" cy="15.5" r="3.5"/>`,
    `<path d="M10.5 13L19 4.5"/>`,
    `<path d="M15.5 5.5l2.5 2.5"/>`,
    `<path d="M18.5 2.5L21 5"/>`,
  ],
  branch: [
    `<circle cx="7" cy="6" r="2.5"/>`,
    `<circle cx="7" cy="18" r="2.5"/>`,
    `<circle cx="17" cy="8.5" r="2.5"/>`,
    `<path d="M7 8.5v7"/>`,
    `<path d="M17 11c0 3.5-5 2.5-7.5 4"/>`,
  ],
};

// ─── which glyph, in which tier, for what ───────────────────────────────────
// `id` is the icon-definition name and the SVG filename, so one row here is the
// whole story for one icon: glyph, colour, and everything that resolves to it.
const icons = [
  // structure
  { id: "folder", glyph: "folder", color: AMBER },
  { id: "folder-open", glyph: "folder-open", color: AMBER },
  { id: "root", glyph: "root", color: AMBER },
  { id: "root-open", glyph: "root-open", color: AMBER },

  // the house language
  { id: "ts", glyph: "braces", color: TEXT, ext: ["ts", "mts", "cts"], lang: ["typescript"] },
  { id: "tsx", glyph: "atom", color: TEXT, ext: ["tsx"], lang: ["typescriptreact"] },

  // languages and formats worth naming
  { id: "js", glyph: "angle", color: MUTED, ext: ["js", "mjs", "cjs"], lang: ["javascript"] },
  { id: "jsx", glyph: "atom", color: MUTED, ext: ["jsx"], lang: ["javascriptreact"] },
  { id: "md", glyph: "lines", color: MUTED, ext: ["md", "mdx", "txt"], lang: ["markdown"] },
  { id: "css", glyph: "hash", color: MUTED, ext: ["css", "scss", "sass", "less"], lang: ["css", "scss", "less"] },
  { id: "html", glyph: "layout", color: MUTED, ext: ["html", "htm", "xml", "svelte", "vue"], lang: ["html", "xml"] },
  { id: "ex", glyph: "droplet", color: MUTED, ext: ["ex", "exs", "eex", "heex"], lang: ["elixir"] },
  { id: "kt", glyph: "wedge", color: MUTED, ext: ["kt", "kts"], lang: ["kotlin"] },
  { id: "sh", glyph: "prompt", color: MUTED, ext: ["sh", "bash", "zsh", "fish"], lang: ["shellscript"] },
  { id: "image", glyph: "framed", color: MUTED, ext: ["png", "jpg", "jpeg", "gif", "webp", "avif", "ico"] },
  { id: "svg", glyph: "curve", color: MUTED, ext: ["svg"] },

  // generic and machine-owned
  { id: "file", glyph: "file", color: FAINT },
  { id: "json", glyph: "brackets", color: FAINT, ext: ["json", "jsonc", "json5"], lang: ["json", "jsonc"] },
  { id: "yml", glyph: "rows", color: FAINT, ext: ["yml", "yaml", "toml", "ini", "conf"], lang: ["yaml"] },
  {
    id: "lock",
    glyph: "lock",
    color: FAINT,
    ext: ["lock"],
    names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "mix.lock", "Gemfile.lock", "Cargo.lock"],
  },
  { id: "env", glyph: "key", color: FAINT, ext: ["env", "pem", "key", "crt"], names: [".env", ".env.local", ".env.example", ".npmrc"] },
  { id: "git", glyph: "branch", color: FAINT, names: [".gitignore", ".gitattributes", ".gitmodules", ".gitkeep"] },
];

// ─── emit ───────────────────────────────────────────────────────────────────
const svg = (glyph, color) =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"`,
    `     stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    ...glyphs[glyph].map((el) => "  " + el.replaceAll("{C}", color)),
    `</svg>`,
    ``,
  ].join("\n");

await mkdir(iconDir, { recursive: true });
// Rebuild from scratch: a renamed glyph should not leave its old file behind to
// be silently committed.
for (const f of await readdir(iconDir)) {
  if (f.endsWith(".svg")) await rm(join(iconDir, f));
}

const iconDefinitions = {};
const fileExtensions = {};
const fileNames = {};
const languageIds = {};

for (const icon of icons) {
  const missing = !glyphs[icon.glyph];
  if (missing) throw new Error(`icon "${icon.id}" wants unknown glyph "${icon.glyph}"`);

  await writeFile(join(iconDir, `${icon.id}.svg`), svg(icon.glyph, icon.color));
  iconDefinitions[icon.id] = { iconPath: `./icons/${icon.id}.svg` };

  for (const e of icon.ext ?? []) fileExtensions[e] = icon.id;
  for (const n of icon.names ?? []) fileNames[n] = icon.id;
  for (const l of icon.lang ?? []) languageIds[l] = icon.id;
}

const theme = {
  // Generated by tools/build-icons.mjs — edit the spec there, not this file.
  //
  // Arrows are hidden because the folder glyph already carries open/closed. Two
  // signals for one state is just noise.
  hidesExplorerArrows: true,
  iconDefinitions,
  file: "file",
  folder: "folder",
  folderExpanded: "folder-open",
  rootFolder: "root",
  rootFolderExpanded: "root-open",
  fileExtensions,
  fileNames,
  languageIds,
};

const json = JSON.stringify(theme, null, 2)
  .replace(
    /^\{\n/,
    `{\n  // Generated by tools/build-icons.mjs — edit the spec there, not this file.\n` +
      `  //\n` +
      `  // Arrows are hidden because the folder glyph already carries open/closed.\n` +
      `  // Two signals for one state is just noise.\n`,
  );

await writeFile(join(root, "fileicons", "pingwin-icon-theme.json"), json + "\n");

console.log(
  `${icons.length} icons · ${Object.keys(fileExtensions).length} extensions · ` +
    `${Object.keys(fileNames).length} filenames · ${Object.keys(languageIds).length} languages`,
);
