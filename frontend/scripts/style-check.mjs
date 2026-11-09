/* ═══════════════════════════════════════════════════════════════════
   style-check — which files still use colours that don't follow the
   theme. Run it from the project folder:

       node scripts/style-check.mjs            every file with leftovers
       node scripts/style-check.mjs Catalogues  only paths containing "Catalogues"

   It looks for:
     palette  Tailwind's fixed colours (bg-slate-800, text-amber-400, …)
     hex      colours typed out (#3a2716, text-[#9a3412], rgba(…) in styles;
              plain black shadows, rgba(0,0,0,…), are fine)
     serif    font-serif / font-sans (use font-body, it follows the theme)

   A file is done when it has none. The theme itself (themes.css,
   theme.js) and tailwind.config.js are skipped — that's where colours
   are supposed to live.
   ═══════════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";
const SKIP = ["styles/themes.css", "styles/theme.js", "styles/grimoire.jsx"];
const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const CHECKS = {
  palette: new RegExp(`\\b(?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|decoration|placeholder|accent|caret|shadow)-(?:${PALETTE})-\\d{2,3}\\b`, "g"),
  hex: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|rgba?\(\s*(?!0\s*,\s*0\s*,\s*0\s*[,)])\d/g, // black shadows are fine
  serif: /\bfont-(?:serif|sans)\b/g,
};

const filter = process.argv[2] || "";

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(jsx?|css)$/.test(name)) yield path;
  }
}

const rows = [];
for (const path of files(ROOT)) {
  const rel = relative(ROOT, path).replaceAll("\\", "/");
  if (SKIP.includes(rel) || (filter && !rel.includes(filter))) continue;
  const text = readFileSync(path, "utf8");
  const counts = Object.fromEntries(Object.entries(CHECKS).map(([k, re]) => [k, (text.match(re) || []).length]));
  const total = counts.palette + counts.hex + counts.serif;
  if (total) rows.push({ rel, ...counts, total });
}

rows.sort((a, b) => b.total - a.total);
if (!rows.length) {
  console.log("All clear — every file follows the theme.");
} else {
  const w = Math.max(...rows.map((r) => r.rel.length));
  console.log(`${"file".padEnd(w)}  palette  hex  serif`);
  for (const r of rows) console.log(`${r.rel.padEnd(w)}  ${String(r.palette).padStart(7)}  ${String(r.hex).padStart(3)}  ${String(r.serif).padStart(5)}`);
  console.log(`\n${rows.length} files still to convert.`);
}
