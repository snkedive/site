#!/usr/bin/env node
// Fetches posts from leaflet.pub RSS and generates blog post pages.
// Also updates the post listing in blog/index.html.
// Usage: node scripts/generate-blog.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const RSS_URL = "https://snkedive.leaflet.pub/rss";
const SITE_ROOT = path.join(__dirname, "..");
const BLOG_DIR = path.join(SITE_ROOT, "blog");

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetch(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return "";
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];
    items.push({
      title: getTag(raw, "title"),
      link: getTag(raw, "link"),
      description: getTag(raw, "description"),
      pubDate: getTag(raw, "pubDate"),
      guid: getTag(raw, "guid"),
    });
  }
  return items;
}

function slugFromLink(link) {
  return link.replace(/\/$/, "").split("/").pop();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function generatePostPage(item, template) {
  const date = formatDate(item.pubDate);
  const content = [
    `          <h1>${item.title}</h1>`,
    `          <p class="post-date">${date}</p>`,
    `          <div class="post-content">${item.description}</div>`,
    `          <p><a href="/blog/">&larr; back to blog</a></p>`,
  ].join("\n");

  return template.replace(
    /(<main[^>]*>)[\s\S]*?(<\/main>)/,
    `$1\n${content}\n        $2`
  );
}

function generateListing(items) {
  if (items.length === 0) return "          <!-- no posts yet -->";
  return items
    .slice()
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .map((item) => {
      const slug = slugFromLink(item.link);
      const date = formatDate(item.pubDate);
      return [
        `          <h2><a href="/blog/${slug}/">${item.title}</a></h2>`,
        `          <p class="post-date">${date}</p>`,
      ].join("\n");
    })
    .join("\n");
}

async function main() {
  console.log("Fetching RSS...");
  const xml = await fetch(RSS_URL);
  const items = parseItems(xml);
  console.log(`Found ${items.length} post(s).`);

  if (items.length === 0) {
    console.log("Nothing to generate.");
    return;
  }

  const template = fs.readFileSync(path.join(BLOG_DIR, "index.html"), "utf8");

  // Generate individual post pages
  for (const item of items) {
    const slug = slugFromLink(item.link);
    const dir = path.join(BLOG_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    const html = generatePostPage(item, template);
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    console.log(`  wrote blog/${slug}/index.html`);
  }

  // Update post listing in blog/index.html
  const listing = generateListing(items);
  const updated = template.replace(
    /(<!-- POSTS_START -->)[\s\S]*?(<!-- POSTS_END -->)/,
    `$1\n${listing}\n          $2`
  );
  fs.writeFileSync(path.join(BLOG_DIR, "index.html"), updated, "utf8");
  console.log("Updated blog/index.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
