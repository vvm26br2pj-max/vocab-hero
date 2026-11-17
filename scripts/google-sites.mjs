#!/usr/bin/env node
// Turns dist-single/index.html into one plain-ASCII file for pasting into Google Sites → Insert → Embed → Embed code.
// Non-ASCII characters (emoji, symbols, curly quotes) become escapes so the text shows correctly even if the host
// does not treat the page as UTF-8.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist-single', 'index.html');
const out = path.resolve(root, '..', 'vocab-hero-google-sites.html');
let html = fs.readFileSync(src, 'utf8');

const jsEsc = (s) => s.replace(/[^\x00-\x7f]/gu, (ch) => [...ch].map((c) => {
  const cp = c.codePointAt(0);
  if (cp < 0x10000) return '\\u' + cp.toString(16).padStart(4, '0');
  const v = cp - 0x10000;
  return '\\u' + (0xd800 + (v >> 10)).toString(16) + '\\u' + (0xdc00 + (v & 0x3ff)).toString(16);
}).join(''));
const cssEsc = (s) => s.replace(/[^\x00-\x7f]/gu, (ch) => '\\' + ch.codePointAt(0).toString(16) + ' ');
const htmlEsc = (s) => s.replace(/[^\x00-\x7f]/gu, (ch) => '&#' + ch.codePointAt(0) + ';');

// escape inside <script> and <style> with their own rules, everything else as HTML entities
const parts = [];
let i = 0;
const re = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi;
let m;
while ((m = re.exec(html))) {
  parts.push(htmlEsc(html.slice(i, m.index)));
  const open = m[0].slice(0, m[0].indexOf('>') + 1);
  const body = m[2];
  parts.push(open + (m[1].toLowerCase() === 'script' ? jsEsc(body) : cssEsc(body)) + `</${m[1]}>`);
  i = m.index + m[0].length;
}
parts.push(htmlEsc(html.slice(i)));
html = parts.join('');

if (/<script[^>]+src=/i.test(html)) throw new Error('An external script is still referenced; the file would not be self-contained.');
if (/[^\x00-\x7f]/.test(html)) throw new Error('Non-ASCII characters remain.');
fs.writeFileSync(out, html);
const chars = html.length;
console.log(`Wrote ${out}`);
console.log(`${(chars / 1e6).toFixed(2)} million characters (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
