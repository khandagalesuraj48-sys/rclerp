# UPDATE 241 – Back from HR shows the ERP, never HR inside this screen (13-11-2026)

**Asked** (with his picture of HR shown small inside the ERP, with its old row of pages): "kadhi kadhi hi screen diste yar jewa
back kel jate jar purn back zal tr erp madhe yeude pn hi screen nkoy".

## Why it happened
RCL HR opens in a frame in the middle and at once takes the whole window (update-240, HR's own change). The browser's **Back**
then brings the ERP page back exactly as it was left (the browser keeps it in memory) – with HR's frame still shown. That HR had
already given the window away once, so it stayed there, inside the ERP, with the look it has inside a frame.

## What changed (`app/App.html` only)
When this page comes back from the browser's memory (`pageshow`, `persisted`) and a module that opens at once (`RAIL_DIRECT` –
RCL HR) is the one in the middle: the page he was on before HR is shown again (`showTab(S.curTab || 'dash', true)`) and HR's
frame is removed. The next press on RCL HR makes a new frame, and HR takes the window again.
Nothing else: the Store, Engineering and Purchase open inside the screen as before; no server file; **no SQL**.

## Evidence
* Unit tests: `timeout 300 node --test test/unit.test.js` – all pass (a new test for this update).
* The page's script blocks parse.

## Not verified
* **Not tried in a browser** – the local copy of the whole set-up with HR under one address was not built for this. To be checked
  on live after the merge: ERP → RCL HR → browser Back → the ERP's own page is there; RCL HR again → HR opens in the whole window.
* A browser that does not keep the page in memory reloads the ERP on Back – that already showed the ERP.

## Going back
Vercel → Instant Rollback to the previous update.
