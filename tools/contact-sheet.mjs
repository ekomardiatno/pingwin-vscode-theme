#!/usr/bin/env node
// Lays every generated icon out on the pingwin editor background, labelled, as
// one SVG you can actually look at. An icon set that compiles is not an icon
// set that reads — the only test that counts is seeing all of them at once, at
// the size the explorer draws them, on the colour they will sit on.
//
//   node tools/contact-sheet.mjs && qlmanage -t -s 1200 -o /tmp /tmp/pingwin-icons.svg

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(root, "fileicons", "icons");
const out = "/tmp/pingwin-icons.svg";

const COLS = 6;
const CELL = 120;
const SIZE = 56;

const files = (await readdir(iconDir)).filter((f) => f.endsWith(".svg")).sort();
const rows = Math.ceil(files.length / COLS);

const cells = await Promise.all(
  files.map(async (f, i) => {
    const src = await readFile(join(iconDir, f), "utf8");
    const inner = src.replace(/^[\s\S]*?>/, "").replace(/<\/svg>\s*$/, "");
    // Keep stroke/fill, drop the bits that only make sense on a root <svg>.
    // Note: match `\sviewBox=` and `\sxmlns=` with the leading space — a bare
    // /width="[^"]*"/ would happily eat the tail of stroke-width="2".
    const attrs = src
      .match(/<svg([\s\S]*?)>/)[1]
      .replace(/\sxmlns="[^"]*"/, "")
      .replace(/\sviewBox="[^"]*"/, "");
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * CELL;
    return (
      `<g transform="translate(${x + (CELL - SIZE) / 2},${y + 24}) scale(${SIZE / 24})">` +
      `<g${attrs}>${inner}</g></g>\n` +
      `<text x="${x + CELL / 2}" y="${y + CELL - 20}" fill="#71838f" ` +
      `font-family="monospace" font-size="13" text-anchor="middle">${f.replace(".svg", "")}</text>`
    );
  }),
);

await writeFile(
  out,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${rows * CELL}" ` +
    `viewBox="0 0 ${COLS * CELL} ${rows * CELL}">\n` +
    `<rect width="100%" height="100%" fill="#10171d"/>\n` +
    cells.join("\n") +
    `\n</svg>\n`,
);

console.log(`${files.length} icons → ${out}`);
