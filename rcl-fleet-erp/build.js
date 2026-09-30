// Vercel runs this at every deploy: it makes public/index.html (the page) from app/Index.html + app/App.html.
'use strict';
const fs = require('fs'), path = require('path');
const { page, shell } = require('./server/page.js');
const out = path.join(__dirname, 'public');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), shell());
console.log('Built public/index.html – app version ' + page().build);
