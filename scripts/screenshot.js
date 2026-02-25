#!/usr/bin/env node

/**
 * Parallel screenshot capture using Playwright.
 *
 * Usage:
 *   node screenshot.js --outdir /tmp/screenshots <url1> [url2] [url3] ...
 *
 * Options:
 *   --outdir <dir>  Directory to save screenshots (required)
 *   --delay <ms>    Delay before capturing each page (default: 5000)
 *   --width <px>    Viewport width (default: 1920)
 *   --height <px>   Viewport height (default: 1080)
 *
 * Saves screenshots as 0.png, 1.png, etc. in the output directory.
 * Outputs a JSON array of file paths to stdout.
 * Logs progress to stderr so stdout stays clean for piping.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function captureScreenshot(browser, url, index, { delay, width, height, outdir }) {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    process.stderr.write(`Navigating to ${url}\n`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (delay > 0) {
      process.stderr.write(`Waiting ${delay}ms for ${url}\n`);
      await page.waitForTimeout(delay);
    }
    const filePath = path.join(outdir, `${index}.png`);
    await page.screenshot({ type: "png", path: filePath });
    process.stderr.write(`Captured ${url} → ${filePath}\n`);
    return filePath;
  } finally {
    await page.close();
  }
}

async function main() {
  const args = process.argv.slice(2);

  let delay = 5000;
  let width = 1920;
  let height = 1080;
  let outdir = null;
  const urls = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--delay" && i + 1 < args.length) {
      delay = parseInt(args[++i], 10);
    } else if (args[i] === "--width" && i + 1 < args.length) {
      width = parseInt(args[++i], 10);
    } else if (args[i] === "--height" && i + 1 < args.length) {
      height = parseInt(args[++i], 10);
    } else if (args[i] === "--outdir" && i + 1 < args.length) {
      outdir = args[++i];
    } else {
      urls.push(args[i]);
    }
  }

  if (urls.length === 0 || !outdir) {
    process.stderr.write("Usage: screenshot.js --outdir <dir> <url1> [url2] ...\n");
    process.exit(1);
  }

  fs.mkdirSync(outdir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const results = await Promise.all(
      urls.map((url, index) =>
        captureScreenshot(browser, url, index, { delay, width, height, outdir })
      )
    );
    process.stdout.write(JSON.stringify(results));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
