/* ============================================================
   build.js — fold the whole machine into one .html file
   node build.js            -> dist/thinkpad-notes.html
   node build.js --fragment -> dist/thinkpad-notes.fragment.html
                               (same page without the document
                               wrapper, for hosts that supply it)
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fragment = process.argv.includes('--fragment');

let html = read('index.html');

html = html.replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"]+)">\n?/g,
  (_, href) => '<style>\n/* ' + href + ' */\n' + read(href).trim() + '\n</style>\n');

html = html.replace(/[ \t]*<script src="(js\/[^"]+)"><\/script>\n?/g,
  (_, src) => '<script>\n/* ' + src + ' */\n' + read(src).trim() + '\n</script>\n');

const stamp = '<!-- ThinkPad Notes — built ' + new Date().toISOString().slice(0, 10) +
              ' by build.js. Edit the sources, not this file. -->\n';

let out;
if (fragment) {
  /* head bits that must survive, then the body contents */
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const keep = []
    .concat(head.match(/<title>[\s\S]*?<\/title>/g) || [])
    .concat(head.match(/<link rel="preconnect"[^>]*>/g) || [])
    .concat(head.match(/<link rel="stylesheet" href="https:[^>]*>/g) || [])
    .concat(head.match(/<style>[\s\S]*?<\/style>/g) || []);
  const body = html.slice(html.indexOf('<body') , html.lastIndexOf('</body>'));
  out = stamp + keep.join('\n') + '\n' + body.replace(/^<body[^>]*>\n?/, '');
} else {
  out = html.replace('<!doctype html>', '<!doctype html>\n' + stamp.trim());
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const file = 'dist/thinkpad-notes' + (fragment ? '.fragment' : '') + '.html';
fs.writeFileSync(path.join(root, file), out);
console.log(file + '  ' + (out.length / 1024).toFixed(1) + ' KB');
