// Vercel runs this at every deploy: it makes public/index.html (the page) from app/Index.html + app/App.html,
// and the three things that make the page an APP that can be installed on a phone or a computer (05-10-2026):
//   public/manifest.webmanifest – name, colours, icons          public/icons/* – the app icon in the sizes a device asks for
//   public/sw.js                – the service worker: lets the app open when the network is down (the last page it had) and
//                                 carries the build number, so every deploy is a "new version" to an installed app
'use strict';
const fs = require('fs'), path = require('path');
const { page, shell } = require('./server/page.js');
const out = path.join(__dirname, 'public');
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const build = page().build;
fs.writeFileSync(path.join(out, 'index.html'), shell());
const icons = path.join(__dirname, 'app', 'icons');
if (fs.existsSync(icons)) fs.readdirSync(icons).forEach(f => fs.copyFileSync(path.join(icons, f), path.join(out, 'icons', f)));
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Fleet ERP – One Click Solution', short_name: 'Fleet ERP', description: 'Diesel, Log Book and machinery billing for construction sites.',
  start_url: '/', scope: '/', id: '/', display: 'standalone', orientation: 'any', background_color: '#0F1F3D', theme_color: '#0F1F3D', lang: 'en', categories: ['business', 'productivity'],
  icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 1));
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(__dirname, 'app', 'sw.js'), 'utf8').replace('/*BUILD*/', build));
console.log('Built public/index.html – app version ' + build);
