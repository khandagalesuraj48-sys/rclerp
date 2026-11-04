# update-211 – the stock shown less what waits; "Stock short" entries saved by themselves; the phone's entries made with no network (04-11-2026)

**Asked:** "sadhya mala 2 major issue … network naste tewa user app madhun entry kru shakt nahi … next day verification team … stock
nastey … user network aso naso entry kru shakel stock nit rahil accurate rahil … stock aahe 200 ok ekala diesel dile 100 rahayla pahije
100 but user la diste 200 karan verification madhli entry approval zali nahi … logic ne correct ani ekdam perfect pane solve kraycha".
His answers: **all at once**; diesel coming IN (Inward, the To of a transfer) that waits for verification is **not counted until it is
approved**; an entry short of stock is **kept on the server as "Stock short" and saved by itself when an Inward / Transfer brings the
stock** (the stock never below zero); in the app with no network: **Diesel Issue (with its photos), Diesel Inward, Diesel Transfer**.

**No database step** (the requests are the same table as verification – billed_changes; "Short" / "Saved" are its free-text status).
With rcl-mobile **3.85.0** (the phone's part).

## What changes
1. **Diesel that waits is already given.** An entry waiting for verification (Pending) or kept as stock short (Short) is held back at its
   place:
   * the stock **shown** everywhere – Diesel Issue / Transfer / Multiple entries, the stock pills (⏳ what waits), the Dashboard's tanks, the
     answer of every save, the phone – is the books' stock **less what waits there**, with "X L waiting for verification, Y L stock short –
     already taken out" beside it. The reports and the Stock Ledger stay the books (saved entries only);
   * a new issue **or transfer** can take only what is left after them (before: a transfer could take diesel that was waiting);
   * the requests are saved **oldest first**: one being saved (its approval, or the stock arriving) is held only against the requests sent
     before it – the oldest can always go in, two entries never block each other;
   * a change of an entry already in is never refused because of what waits unless it takes more than before (a remark changed – fine).
2. **Stock short.** A diesel issue (one / multiple entries) or transfer (one / multiple) more than the stock: the page and the phone ask
   **"Stock short – keep this entry?"**. Yes: it is checked as a save **without its stock** (every other rule – machinery, readings, photos,
   the date rule …; a wrong entry is refused at once) and kept in **Approvals as "Stock short"** – nothing saved, its diesel held back, what
   it needs now shown ("Needs 20 L more at Dispenser"). It is **saved by itself**, as the sender's own entry with every check of a save, as
   soon as the stock is there – the next heartbeat of any open page or phone after any change of the stock or of the requests, and every
   10 minutes – the oldest first; the sender gets a notification ("Saved – the stock came"); status "Saved" with its DI number. Refused then
   for another reason (machinery left the site, books closed …): "Returned" with the reason. The sender or the Super Admin can take it back.
3. **Under verification:** an entry short of stock is sent for verification as usual (the stock not checked; the message says the stock is
   short). At its **last approval** a stock that is still short keeps it as **"Short" (approved, waits for the stock)** – before, it was
   "Returned" and had to be sent again. Then as 2.
4. **The phone with no network** (rcl-mobile 3.85.0): every getInit / heartbeat gives the phone the server's time **signed with the site's
   secret** (`stamp`). An entry kept on the phone carries its last stamp; when it is sent – maybe the next morning – the server reads its
   own signature and measures the user's date rule ("a user enters only today's entries", update-187) from that day. Good for 3 days; a
   stamp that is not the server's own, or another person's, counts for nothing (measured from today, as before). The phone's clock is never
   trusted. A request made so keeps that day for its approval / Send again / Open & correct.
5. A row of "Multiple entries" without its own source is held at the batch's source (before: the main place).

**Where:** `app/Code.gs` – `api()` (meta `short`, `made`), `flowWaitBy_` / `flowReserved_` (oldest first) / `flowHeldBy_` / `stockNet_` /
`balNet_`, `getStock_`, `getIssueBalance_` (the books' own: `issueBalance_`), `getStockPoints_`, `getTransferBalance_`, `getDashboard_`,
`requireStockAt_` and `transferMessage_` (what waits, never worse), `saveTransferBulk_`, `assertNoNegative_` (off only while a short entry is
checked), `flowSend_` (Short), `flowDecide_` (Short at the last approval), `shortRun_` / `shortRetry_` / `shortTick_` / `shortNeed_`,
`flowAnswer_` (take back a Short), `crList_` (short, need, canTakeBack), `bump_` (SHORT_DUE), `stamp_` / `offlineDay_` / `flowDay_`, `flowFacts_`.
`app/App.html` – `call()` asks "keep as stock short?" (`SHORT_FNS`, `askShort`), no stop on the page before the server, `FLOW_SENT_RE`,
`heldWords` / `heldHtml` (pills, the issue line, the transfer boxes, Multiple entries, the tanks), the stock follows a "flow" change,
Approvals (Stock short / Saved, what it needs, Take back, the count), "My entries in verification", the help (`FIX_RULES`, 3 languages).

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – **164 / 164**. New `update-211`: the stock shown less what waits (getStock,
  getIssueBalance, getStockPoints, getTransferBalance); a short entry kept (nothing saved; not twice; a wrong one refused; only diesel
  issue / transfer); what waits held back from a new issue, a transfer and Multiple entries of transfers; a remark changed not refused,
  more refused; two short entries – an inward – the oldest saved by the next heartbeat, the second waits (what it needs: 20 L); taken back
  only by the sender / Super Admin; under verification – sent with the stock short, approved → Short → saved when the stock came; the stamp
  (good, forged, another person's, older than 3 days, the future) and an entry of yesterday sent today with it; the help. Updated words /
  code checks in `update-114`, `update-120`, `update-162`, `update-187`, `update-188`.
* The rig (`bash rig/all.sh`) in Chromium, 14 / 14 (`u211/flow.js`): asked (मराठी) with the server's words; Cancel – refused as before;
  Keep – "Kept as stock short – VF-…"; the pills at once "Dispenser −75 ⏳ 28,575"; the issue line "… stock short – already taken out";
  Approvals – Stock short, Take back; an inward → saved by itself ("Saved: DI-… (the stock came)"); nothing waits after; no page error.
  Pictures looked at.
* The rig API tests: `test/flow114api.js` 30 / 30 (its words updated), `test/places117api.js` 33 / 33.
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; no secret in the change.

## Not verified
* Not on the live site; not with several sites' real data; not a real phone with no network (the app's part: its own tests and pictures
  on GitHub Actions).
* `test/photo85api.js` and `test/inward120api.js` fail on this rig the same way before this change (their fixture machinery and an old
  database step are not on the rig any more) – the photo rules themselves are covered by the unit tests.

## Going back
Vercel → Instant Rollback to the update before. Requests kept as "Short" meanwhile stay in Approvals (nothing of them is saved); the
update before shows them with their status and does not save them – take them back there, or enter them again.
