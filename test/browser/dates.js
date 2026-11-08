// which date fields may be in the future? every date field of every page is set to a date next year: only ENTRY dates may complain
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms)); const out = [];
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const res = await f.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const warned = [], quiet = [];
    for (const t of TABS) { try { closeConfirm(false); } catch (e) {} showTab(t); await sleep(250); try { closeConfirm(false); } catch (e) {}
      if (t === 'boq') { const nb = [...document.querySelectorAll('#sec-boq button')].find(x => /New BOQ|\+ New|Add BOQ/i.test(x.textContent)); if (nb) { nb.click(); await sleep(300); } }
      const sec = document.getElementById('sec-' + t); if (!sec) continue;
      for (const el of sec.querySelectorAll('input[type=date]')) { if (el.offsetParent === null || el.disabled || el.readOnly) continue; const keep = el.value; if (document.getElementById('fixbox')) document.getElementById('fixbox').hidden = true;
        el.removeAttribute('max'); el.value = '2027-01-01'; el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(30);
        const bx = document.getElementById('fixbox'), on = bx && !bx.hidden && /is after today/.test(bx.textContent); const name = t + ' › ' + (el.id || el.dataset.f || '?') + ' (' + ((el.closest('.field') || el.closest('td') || el).querySelector('label') || { textContent: '' }).textContent.trim().slice(0, 28) + ')';
        (on ? warned : quiet).push(name); el.value = keep; el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(20); if (bx) bx.hidden = true; el.classList.remove('live-bad'); } }
    return { warned, quiet }; });
  out.push('FUTURE DATE IS POINTED OUT (entry dates):', ...res.warned.map(x => '  ' + x), '', 'FUTURE DATE IS ALLOWED (no message):', ...res.quiet.map(x => '  ' + x));
  fs.writeFileSync('/tmp/dates.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/dates.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 400)); process.exit(1); });
