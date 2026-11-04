const MarkdownParser = {
inlineRules: [
{ reg: /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g, replace: (m, t) => `\u0000T${t.push(m) - 1}\u0000` },
{ reg: /!\[([^\]]*)\]\(([^)\s]+)\)/gi, replace: '<img src="$2" alt="$1">' },
{ reg: /\[([^\]]+)\]\(((?:ext\s+)?([^)\s]+))\)/gi, replace: (_, l, f, u) => `<a href="${u}"${f.toLowerCase().startsWith('ext ') ? ' target="_blank"' : ''} rel="noopener noreferrer">${l}</a>` },
{ reg: /~~([^~]+?)~~/g, replace: '<del>$1</del>' },
{ reg: /\*\*([^*]+?)\*\*/g, replace: '<strong>$1</strong>' },
{ reg: /__([^_]+?)__/g, replace: '<u>$1</u>' },
{ reg: /(^|[^\w])\*([^* \n][^*\n]*?)\*(?!\w)/g, replace: '$1<em>$2</em>' },
{ reg: /:([a-zA-Z0-9_-]+)\s+([^:]+?):/g, replace: '<span class="$1">$2</span>' }
],
parse(md) {
const tokens = [], html = [], paragraphs = [];
let inTable = false, inList = false, listType = null;
const flush = () => {
if (!paragraphs.length) return;
const text = paragraphs.join("\n").trim();
if (text) {
const m = text.match(/^:([a-zA-Z0-9_-]+)\s+(.+)$/s);
html.push(m ? `<p class="${m[1]}">${this.parseInline(m[2], tokens)}</p>` : `<p>${this.parseInline(text, tokens)}</p>`);
}
paragraphs.length = 0;
};
const closeList = () => { if (inList) { html.push(`</${listType}>`); inList = false; listType = null; }};
for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
const trimmed = line.trim();
if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
closeList();
if (!inTable) { flush(); html.push('<table>'); inTable = true; }
if (/^\|[\s\d\w]*[:\s\-|]*\|$/.test(trimmed) && trimmed.includes('-')) continue;
const cells = trimmed.split('|').slice(1, -1), tag = html[html.length - 1] === '<table>' ? 'th' : 'td';
html.push(`<tr>${cells.map(c => `<${tag}>${this.parseInline(c.trim(), tokens)}</${tag}>`).join('')}</tr>`);
continue;
}
const listMatch = trimmed.match(/^([\*\-\+]|\d+\.)\s+(.+)$/);
if (listMatch) {
const isOl = /\d/.test(listMatch[1]), type = isOl ? 'ol' : 'ul', content = listMatch[2];
if (inList && listType !== type) closeList();
if (!inList) { flush(); html.push(`<${type}>`); inList = true; listType = type; }
html.push(`<li>${this.parseInline(content, tokens)}</li>`);
continue;
}
if (inTable) { html.push('</table>'); inTable = false; }
closeList();
if (!trimmed) { flush(); continue; }
if (/^<\/?[a-zA-Z][^>]*>|^<!--[\s\S]*-->/.test(trimmed)) { flush(); html.push(line); continue; }
if (/^!\[([^\]]*)\]\(([^)\s]+)\)$/.test(trimmed)) { flush(); html.push(this.parseInline(trimmed, tokens)); continue; }
const h = line.match(/^(#{1,6})[ \t]+(.+?)\s*#*\s*$/);
if (h) { flush(); html.push(`<h${h[1].length}>${this.parseInline(h[2], tokens)}</h${h[1].length}>`); continue; }
paragraphs.push(line);
}
if (inTable) html.push('</table>');
closeList(); flush();
const result = html.join("\n");
tokens.length = 0; 
return result;
},
parseInline(text, tokens) {
let res = text.replace(this.inlineRules[0].reg, m => this.inlineRules[0].replace(m, tokens));
res = res.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
for (let i = 1; i < this.inlineRules.length; i++) res = res.replace(this.inlineRules[i].reg, this.inlineRules[i].replace);
return res.replace(/\u0000T(\d+)\u0000/g, (_, i) => tokens[i]);
},
async init() {
const controller = new AbortController();
window.addEventListener('pagehide', () => controller.abort(), { once: true });
window.addEventListener('unload', () => controller.abort(), { once: true });
try {
await Promise.all(Array.from(document.querySelectorAll('[data-md-src]')).map(async div => {
const url = div.dataset.mdSrc;
try {
const startFetch = performance.now();
const r = await fetch(url, { signal: controller.signal });
if (!r.ok) throw new Error(`HTTP ${r.status}`);
const text = await r.text();
const endFetch = performance.now();
const startParse = performance.now();
const html = this.parse(text);
div.innerHTML = html;
const endParse = performance.now();
console.log(
`%c${url}%c\n` +
`Hämta: ${(endFetch - startFetch).toFixed(2)}ms\n` +
`Parsning: ${(endParse - startParse).toFixed(2)}ms\n` +
`Total Tid: ${(endParse - startFetch).toFixed(2)}ms`,
"color: #007acc; font-weight: bold;", "color: inherit; font-weight: normal;"
);
} catch (e) {
if (e.name !== 'AbortError') div.innerHTML = `<span class="r">${e.message}</span>`;
}}));
} catch (e) {
console.error("designochkod-parser.js Init Error:", e);
}}};
document.readyState === 'loading' 
? document.addEventListener('DOMContentLoaded', () => MarkdownParser.init()) 
: MarkdownParser.init();
