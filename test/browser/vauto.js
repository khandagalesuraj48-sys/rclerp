// Vendor form: a GST number fills the PAN and says the State; an IFSC fills the bank and branch
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('vendors'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('v_new').click(); const g = document.getElementById('v_gstreg'); g.value = 'Yes'; g.dispatchEvent(new Event('change', { bubbles: true })); });
  const type = (id, v) => f.evaluate((i, x) => { const el = document.getElementById(i); el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, id, v);
  const st = () => f.evaluate(() => ({ gst: document.getElementById('v_gst').value, gh: document.getElementById('v_gst_hint').textContent, gbad: document.getElementById('v_gst_hint').classList.contains('bad'), pan: document.getElementById('v_pan').value, bank: document.getElementById('v_bank').value, branch: document.getElementById('v_branch').value, ih: document.getElementById('v_ifsc_hint').textContent, ibad: document.getElementById('v_ifsc_hint').classList.contains('bad') }));
  // ---- GST number ----
  await type('v_gst', '27aakcr9897b1zq'); let s = await st();
  ok('a full GST number: checked, the State and kind of party said, the PAN filled in', s.gst === '27AAKCR9897B1ZQ' && s.pan === 'AAKCR9897B' && /Maharashtra \(27\) · Company · PAN AAKCR9897B filled in/.test(s.gh) && !s.gbad, s);
  await type('v_gst', '27AAKCR9897B1ZR'); s = await st();
  ok('one wrong character is caught by the check letter', s.gbad && /last letter does not fit .* would be "Q"/.test(s.gh), s.gh);
  await type('v_gst', '27AFGFS3815J1ZQ'); s = await st();
  ok('another GST number: the PAN that was filled by the app follows (a firm)', s.pan === 'AFGFS3815J' && /Firm \/ LLP/.test(s.gh), s);
  await type('v_pan', 'ABCDE1234F'); await type('v_gst', '27AFGFS3815J1ZQ'); s = await st();
  ok('a PAN typed by hand is kept, and the difference is pointed out', s.pan === 'ABCDE1234F' && s.gbad && /is not the PAN of this GST number \(AFGFS3815J\)/.test(s.gh), s.gh);
  await type('v_gst', '99AAKCR9897B1Z'); s = await st(); ok('an unfinished number only asks for the rest', /Type all 15 characters/.test(s.gh) && !s.gbad, s.gh);
  // ---- IFSC: the bank list is played by the test (the real one cannot be reached from the test rig) ----
  await f.evaluate(() => { window.__asked = []; const real = window.fetch; window.fetch = (u, o) => { u = String(u); if (u.indexOf('ifsc.razorpay.com') === -1) return real(u, o); window.__asked.push(u);
      if (/SBIN0001234$/.test(u)) return Promise.resolve(new Response(JSON.stringify({ BANK: 'State Bank of India', IFSC: 'SBIN0001234', BRANCH: 'NASHIK ROAD', CITY: 'NASHIK', STATE: 'MAHARASHTRA', ADDRESS: 'x' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      if (/HDFC0009999$/.test(u)) return Promise.resolve(new Response('"Not Found"', { status: 404 }));
      return Promise.reject(new TypeError('Failed to fetch')); }; });
  await type('v_ifsc', 'sbin0001234'); await wait(500); s = await st();
  ok('IFSC typed: the bank and branch are filled in', s.bank === 'State Bank of India' && s.branch === 'NASHIK ROAD' && /✔ State Bank of India – NASHIK ROAD, NASHIK, MAHARASHTRA/.test(s.ih) && !s.ibad, s);
  ok('only the IFSC code is sent, once', await f.evaluate(() => window.__asked.length === 1 && window.__asked[0] === 'https://ifsc.razorpay.com/SBIN0001234'), await f.evaluate(() => window.__asked.join(' ; ')));
  await type('v_ifsc', 'HDFC0009999'); await wait(500); s = await st();
  ok('an IFSC that is not a branch is said; the bank typed before stays', s.ibad && /not in the list of bank branches/.test(s.ih) && s.bank === 'State Bank of India', s.ih);
  await type('v_ifsc', 'ICIC0000001'); await wait(500); s = await st();
  ok('no connection to the list: a plain note, nothing is lost', !s.ibad && /could not be looked up now/.test(s.ih) && s.bank === 'State Bank of India', s.ih);
  await type('v_ifsc', 'SBIN001234'); s = await st(); ok('an unfinished IFSC only asks for the rest', /Type all 11 characters/.test(s.ih), s.ih);
  await type('v_ifsc', 'SBIN1001234'); s = await st(); ok('a wrong shape (5th character must be 0) is said without asking the list', s.ibad && /not in the right format/.test(s.ih), s.ih);
  await p.screenshot({ path: 'shots/vauto.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/vauto.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/vauto.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
