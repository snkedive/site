#!/usr/bin/env node
// Syncs shared layout sections from index.html to all other HTML pages.
// Syncs: topBar, headerArea, aside#rightSidebar, footer, and the inline <script>.
// Preserves per-page: <main> content and <style> block.
// Usage: node scripts/sync-layout.js

const fs = require("fs");
const path = require("path");

const SITE_ROOT = path.join(__dirname, "..");
const SOURCE = path.join(SITE_ROOT, "index.html");

// Each entry: { pattern to extract from source, pattern to replace in target }
const SECTIONS = [
  {
    name: "topBar",
    re: /<div id="topBar">[\s\S]*?<\/div>/,
  },
  {
    name: "headerArea",
    re: /<div id="headerArea">[\s\S]*?<\/div>\s*<\/div>/,
    // headerArea contains a nested div, so we match the outer closing tag carefully
  },
  {
    name: "rightSidebar",
    re: /<aside id="rightSidebar">[\s\S]*?<\/aside>/,
  },
  {
    name: "footer",
    re: /<footer id="footer">[\s\S]*?<\/footer>/,
  },
  {
    name: "script",
    re: /<script>[\s\S]*?<\/script>/,
  },
];

// headerArea has nested divs so needs a smarter extractor
function extractHeaderArea(html) {
  const start = html.indexOf('<div id="headerArea">');
  if (start === -1) return null;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (
      html.startsWith("<div", i) &&
      (html[i + 4] === " " || html[i + 4] === ">")
    )
      depth++;
    else if (html.startsWith("</div>", i)) {
      depth--;
      if (depth === 0) return html.slice(start, i + 6);
    }
    i++;
  }
  return null;
}

function extract(html, section) {
  if (section.name === "headerArea") return extractHeaderArea(html);
  const m = html.match(section.re);
  return m ? m[0] : null;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

const sourceHtml = fs.readFileSync(SOURCE, "utf8");

// Pre-extract all sections from source
const replacements = SECTIONS.map((section) => {
  const content = extract(sourceHtml, section);
  if (!content)
    throw new Error(
      `Could not extract section "${section.name}" from index.html`,
    );
  return { section, content };
});

const allFiles = findHtmlFiles(SITE_ROOT).filter((f) => f !== SOURCE);
let updated = 0;

for (const file of allFiles) {
  let html = fs.readFileSync(file, "utf8");
  let changed = false;

  for (const { section, content } of replacements) {
    const current = extract(html, section);
    if (!current) continue; // section not present in this file, skip
    if (current === content) continue; // already up to date
    html = html.replace(current, content);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, html, "utf8");
    console.log(`  synced ${path.relative(SITE_ROOT, file)}`);
    updated++;
  }
}

console.log(`Done. Updated ${updated} file(s).`);
