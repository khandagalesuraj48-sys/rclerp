// update-85: the app opens only with the location on. The browser tests that are not about the location itself are run with
//     NODE_OPTIONS="--require <path>/geo-shim.js" node <test>.js
// Every page they open then has the permission and a place (Nashik, 20 m). Nothing of the app is changed – this only does what
// a phone with its location on does. A test about the location (photo85.js) sets the place itself and does not need this.
'use strict';
const Module = require('module');
const PLACE = { latitude: 19.997453, longitude: 73.789802, accuracy: 20 };
const load = Module._load;
let patched = false;
Module._load = function (request) {
  const m = load.apply(this, arguments);
  if (!patched && request === 'puppeteer-core' && m && typeof m.launch === 'function') {
    patched = true;
    const launch = m.launch.bind(m);
    m.launch = async (...args) => { const b = await launch(...args); patchBrowser(b); return b; };
  }
  return m;
};
// "grant" gives the permission to ONE address and takes it from every other – so it is given to the address a page opens, as it
// opens it (page.goto)
// (one session per browser, kept open: a permission given through a session ends when that session is closed)
const sessions = new WeakMap();
async function grant(b, ctxId, origin) {
  if (!sessions.has(b)) sessions.set(b, b.target().createCDPSession());
  const s = await sessions.get(b);
  await s.send('Browser.grantPermissions', Object.assign({ origin: origin, permissions: ['geolocation'] }, ctxId ? { browserContextId: ctxId } : {}));
}
function patchPageMaker(owner, b, ctxId) {
  const newPage = owner.newPage.bind(owner);
  owner.newPage = async (...a) => {
    const p = await newPage(...a); await p.setGeolocation(PLACE);
    const go = p.goto.bind(p);
    p.goto = async (url, o) => { try { await grant(b, ctxId, new URL(url).origin); } catch (e) { if (process.env.GEO_DEBUG) console.error('geo-shim: ' + e.message); } return go(url, o); };
    return p;
  };
}
function patchBrowser(b) {
  patchPageMaker(b, b, undefined);
  for (const name of ['createBrowserContext', 'createIncognitoBrowserContext']) {
    if (typeof b[name] !== 'function') continue;
    const make = b[name].bind(b);
    b[name] = async (...a) => { const ctx = await make(...a); patchPageMaker(ctx, b, ctx.id); return ctx; };
  }
}
