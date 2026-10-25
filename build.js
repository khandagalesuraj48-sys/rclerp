// Vercel runs this at every deploy: it makes public/index.html (the page) from app/Index.html + app/App.html,
// and the three things that make the page an APP that can be installed on a phone or a computer (05-10-2026):
//   public/manifest.webmanifest – name, colours, icons          public/icons/* – the app icon in the sizes a device asks for
//   public/sw.js                – the service worker: lets the app open when the network is down (the last page it had) and
//                                 carries the build number, so every deploy is a "new version" to an installed app
'use strict';
const fs = require('fs'), path = require('path');
const { page, shell, menu } = require('./server/page.js');
const out = path.join(__dirname, 'public');
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const build = page().build;
fs.writeFileSync(path.join(out, 'index.html'), shell());
const icons = path.join(__dirname, 'app', 'icons');
if (fs.existsSync(icons)) fs.readdirSync(icons).forEach(f => fs.copyFileSync(path.join(icons, f), path.join(out, 'icons', f)));
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Fleet ERP – One Click Solution', short_name: 'Fleet ERP', description: 'Diesel, Log Book and machinery billing for construction sites.',
  start_url: '/', scope: '/', id: '/', display: 'standalone', orientation: 'any', background_color: '#0F1F3D', theme_color: '#0F1F3D', lang: 'en', categories: ['business', 'productivity'],
  icons: [{ src: '/icons/oc2-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icons/oc2-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icons/oc2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 1));
// the Excel tools the page uses, served from the app's own address (app/vendor → /vendor/…)
const vend = path.join(__dirname, 'app', 'vendor');
if (fs.existsSync(vend)) { fs.mkdirSync(path.join(out, 'vendor'), { recursive: true }); fs.readdirSync(vend).filter(f => /\.js$/.test(f)).forEach(f => fs.copyFileSync(path.join(vend, f), path.join(out, 'vendor', f))); }
// (update-110) the words of the app in Marathi and Hindi (app/i18n → /i18n/mr.json, /i18n/hi.json), fetched by the page when a user picks the language
fs.mkdirSync(path.join(out, 'i18n'), { recursive: true });
['mr', 'hi'].forEach(l => fs.copyFileSync(path.join(__dirname, 'app', 'i18n', l + '.json'), path.join(out, 'i18n', l + '.json')));
// (13-10-2026, one address) this module's pages for the other modules' menus (server/page.js menu)
fs.writeFileSync(path.join(out, 'menu.json'), JSON.stringify(menu()));
// (update-160, asked 25-10-2026: "google scanner mobile scanner madhun jari scan kel adhi app kade jaw app nasel tr browser kade")
// the phone's own camera / Google Lens open a "Scan with Mobile" QR (/scan?cap=…) in the RCL ERP app: Android checks this file (the
// app's name and the PUBLIC fingerprint of its signing key – not a secret) – /.well-known/assetlinks.json
fs.mkdirSync(path.join(out, '.well-known'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'app', 'well-known', 'assetlinks.json'), path.join(out, '.well-known', 'assetlinks.json'));
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(__dirname, 'app', 'sw.js'), 'utf8').replace('/*BUILD*/', build));
console.log('Built public/index.html – app version ' + build);
