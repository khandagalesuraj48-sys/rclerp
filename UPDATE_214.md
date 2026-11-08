# update-214 – The Driver-wise Report; Maintenance in the Machinery Cost Sheet (08-11-2026)

**Asked:** the features for HO and every site – "ata he sagle ek sath bana ani ha ho sathi pn ani other site sathi pn he hawe aahet".
**This is step B** (features 3 and 4): "Driver nusar report, ani Machinery Cost Sheet madhe maintenance cha kharch". **No database
step.** With **rcl-mobile 3.89.0**. Comes after update-213 (this branch is on top of it – merge update-213 first).

## What changes
1. **Reports → Driver-wise Report** (new, every site; Reports access – `rptDriver`, `app/Code.gs`): for every driver in the dates (the
   name written in the Log Book and on the fills – the same name in any case / spacing is one driver):
   * the days he drove, his KM / Hrs / trips (the Log Book – not a Holiday / Idle / Breakdown day);
   * his fills and litres; **at a site on fuel cards (HO) also their ₹** (card + cash, as entered);
   * machinery by machinery: **his average** (his KM ÷ his litres, or his litres ÷ his Hrs) against its standard – Good / More diesel
     (over 10 %) / Bad (over 30 %), exactly as Actual vs Standard Average. A Debit Basis machinery keeps no average.
   * A Log Book day or a fill with no driver written: "(no driver written)", at the end. Print, Excel as every report.
2. **Machinery Cost Sheet → Maintenance (₹)** (every site): its maintenance bills of the dates (what RCL paid – the insurance's part and a
   free line not counted, as the Maintenance Log Book) + **the RCL Store's outward** to it (one read of `store_issue` for the dates; an
   issue on debit to its owner is not our cost). Net cost = Rent + Diesel + **Maintenance** − Recovered; ₹ / Hr and ₹ / KM follow. A
   machinery with only a bill in the dates is listed too. The line under each machinery shows the working ("Maintenance ₹… (n bills ₹… +
   n store outward ₹…)").
3. **At a site on fuel cards (HO)** the cost sheet's fuel cost is **what its fills cost** (card + cash) – there is no diesel rate there
   (before: ₹ 0). So HO's car cost per KM = fuel ₹ + maintenance ₹ ÷ its KM.
4. The report help (3 languages) and the assistant's reading of the cost sheet include the maintenance.

## Evidence
* Unit: `timeout 500 node --test test/unit.test.js` – **167 / 167**. New `update-214`: two drivers (one name in two spellings = one
  driver), his days / KM / Hrs / litres, his average Good (6.67 % over) and More diesel (20 %), a Hrs machinery, "(no driver written)" at
  the end; the cost sheet's maintenance = the bill 2,000 + the Store's outward 500 (a debit issue of 999 not counted; June's not in May),
  net = rent + diesel + maintenance − recovered, a machinery with only a bill listed; at a site on fuel cards the fuel = the fills' ₹
  (1,050) and the driver's ₹; the access (Reports); the page's report and its help.
* The rig in Chromium (`scratchpad/hod/web214.js`, **21 / 21**): S1 (a site with stock) – a bill of ₹1,800 and two Store issues put in
  (640 ours, 999 on debit): Maintenance +₹2,440, net right; the page draws "Maintenance (₹)" and the working line; the Driver-wise Report
  drawn, Excel ready. T2 put on fuel cards as HO – two cars, fills with drivers, Log Book days, a bill: fuel ₹6,650 / ₹4,725 as the fills
  cost, maintenance ₹3,200, ₹20.52 per KM; drivers' ₹; his average 6.86 km/L against 12 – Bad; the page (desktop and phone width – the
  page itself does not scroll sideways); no page error. Everything put back after.
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; no secret in the change.

## Not verified
* The live sites' real data. A site with several fuels shows a report of one fuel at a time (the Fuel box – as every report since
  update-163).
* Step C (HO fill photos, tyre / battery) and the second part (booking, toll) – not in this update.

## Going back
Vercel → Instant Rollback. Nothing is saved by these reports.
