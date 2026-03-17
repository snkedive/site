#!/usr/bin/env node
// Syncs the <aside id="rightSidebar"> from index.html to all other HTML pages.
// Usage: node scripts/sync-sidebar.js

const fs = require("fs");
const path = require("path");

const SITE_ROOT = path.join(__dirname, "..");
const SOURCE = path.join(SITE_ROOT, "index.html");

function extractAside(html) {
  const match = html.match(/<aside id="rightSidebar">([\s\S]*?)<\/aside>/);
  if (!match) throw new Error("Could not find <aside id=\"rightSidebar\"> in source file");
  return match[0];
}

function replaceAside(html, aside) {
  const replaced = html.replace(/<aside id="rightSidebar">[\s\S]*?<\/aside>/, aside);
  if (replaced === html) throw new Error("Could not find <aside id=\"rightSidebar\"> to replace");
  return replaced;
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
const aside = extractAside(sourceHtml);

const allFiles = findHtmlFiles(SITE_ROOT).filter((f) => f !== SOURCE);
let updated = 0;

for (const file of allFiles) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes('id="rightSidebar"')) continue;
  const newHtml = replaceAside(html, aside);
  fs.writeFileSync(file, newHtml, "utf8");
  console.log(`  synced ${path.relative(SITE_ROOT, file)}`);
  updated++;
}

console.log(`Done. Updated ${updated} file(s).`);
