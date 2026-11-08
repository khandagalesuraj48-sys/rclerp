# update-114 – Verification of every work: the Super Admin's rules, levels of named people (15-10-2026)

**Asked:** "pratek kamach verification approval systeam banwaych aahe new task je je add htil tyana pn ani old je astil tyana pn
but konte task la verification approval systeam lawaychi ka nahi he super admin tharwel … send to verification … approval kona
kade janar ani tyan approval kel ki pudh pn approval sathi janr ki nahi … jr approval ale ki systeam madhe data add honar … app
madhe live sync haway". Then: "approval he department designation la nko … user wise … mla jyana asign krel tyanach hoil baki tu
jo vichar kela tech kr all banaw".

## How it works
* **Rules (Super Admin only, Approvals → "Verification rules", per site).** Every page that saves data is a work (Diesel Issue,
  Log Book, Diesel Inward, Diesel Transfer, Asset Master, Vendor Master, Vendor BOQ, Machinery Billing, Machinery Payments,
  Vehicle Compliance, Breakdown – 11 at the rig). A page added to the app later shows up in the list by itself. For each work:
  * on / off;
  * **levels** (up to 5), each a list of **named users** (ticked by name – not a department or designation). Any one person of a
    level approves it; the others of that level are the backup;
  * **only when** (optional): entries dated more than N days back, and / or (diesel) more than X litres. Empty = every entry;
  * "Remind after N hours" (default 4).
  Settings and checks are not works (tank settings, bill settings, Log Book formats, compliance rules, debit rates, "verify bills").
* **A save of such a work** (by anyone except the Super Admin):
  1. it is first **checked** as a save – every rule of the save runs; a wrong entry is refused at once as before, nothing sent;
  2. it is kept as a **request** ("VF-00001") and the person is told: *"Sent for verification to Checker – VF-00001. It is saved
     when it is approved; nothing is saved until then."* (a green message, the form is emptied);
  3. **nothing of it is in the data**: not in the lists, the stock, the bills or the reports. No entry number is used up.
  4. Diesel waiting for verification is **held back from the stock** that can still be issued (the message says
     "(300 Ltr more waits for verification)"), so the same litres are not given twice.
* **Approve**: level 1 → level 2 → … At the **last** level the save runs **now, as the sender's own entry** (his name in the entry
  and in the Activity Log), with every check of a save again. If it can no longer be saved (something changed meanwhile – e.g.
  the same vendor was added, the stock is gone, the month was closed), it goes back to the sender as **Returned** with the reason;
  nothing is half-saved.
* **Reject**: needs a reason; the sender reads it. Nothing is saved.
* **Maker-checker**: nobody approves his own entry (if he is on the level, it goes to the others of the level). The Super Admin may
  decide any level. The Super Admin's own entries are saved at once.
* **The rules at the moment of sending stay with the request** (a rule changed later does not move requests already waiting).
* **Approvals page** (now for every user): a summary (waiting for you / waiting in all / your entries waiting / oldest waiting),
  the list with the work, level "1 of 2" and who it waits for, the steps (who, when, note), tick boxes and **"Approve ticked" /
  "Reject ticked"** for several at once. The billed-period changes of update-108 stay in the same list as before.
* **Notifications**: the people of the level when something waits for them; the sender when it is decided; a reminder after the
  rule's hours; after twice as long the Super Admin too.
* **Live**: every open page hears of a new or decided request within seconds (the live sync has a new part, "flow") – the list and
  the menu count change without a reload.

## How it is built (no SQL step)
* Requests are kept in the `billed_changes` table of update-108 (step 1z) with Kind "Flow"; the rules in `app_settings`
  (`FLOW_RULES`). Server: `app/Code.gs` block "VERIFICATION OF EVERY WORK" – `flowTasks_`, `getFlowRules_` / `saveFlowRules_`,
  `flowRuleFor_` (called in `api()` before a save), `flowSend_` (the check runs inside the save's lock and is thrown away; counters
  and settings are not written while only checking – `FLOW_DRY_ON_`), `flowDecide_` / `flowDecideMany_`, `flowReserved_` (used by
  `requireStockAt_`), `flowRemind_` (from the heartbeat, at most every 10 minutes). New actions: `decideChangeRequests`,
  `getFlowRules`, `saveFlowRules` (PAGE_GUIDE and FIX_RULES updated; English / Marathi / Hindi).
* `server/runtime.js`: a "sent for verification" answer kept with the save number (update-68) is given again as the same message
  – a copy of the same save sent again is never answered "saved", and nothing "after a save" runs for it.
* Page: the Approvals section, the rules panel, "Sent for verification" is not red and empties the form (Diesel Issue, Bulk,
  Inward, Transfer, Log Book entry). Marathi / Hindi words added for the new texts (and 74 words of texts removed in update-111
  taken out of the dictionaries).

## Evidence (local rig, test data only)
* Unit 78 / 78 – new "update-114" (with a stand-in database that throws away what a failed or check-only save wrote): rules only
  by the Super Admin and checked; a wrong entry refused, not sent; sent = nothing saved; the same entry twice refused; level 1 →
  level 2 → saved; maker cannot approve his own; Super Admin decides any level and saves at once; Returned with the reason;
  several at once; "only when" days back (today saved at once, 5 days back sent; no inward number used up) and litres
  (100 L not sent, 101 L sent); diesel held back and not against itself; reminders once, then the Super Admin; the page and server.
* Rig API `test/flow114api.js` 30 / 30 against the real Postgres: nothing written when sent (vendor, diesel); the same save number
  sent again → the same words, the number closed with them; the live-sync version moves; level 1 → 2 → saved as the maker's
  (Activity Log: Maker 114); several at once; maker-checker; 300 L held back exactly; approved → saved, nothing held any more.
* Browser `test/browser/flow114.js` 12 / 12: the Super Admin's rules panel (add / remove level, save); the maker's diesel issue →
  green "Sent for verification", form emptied, nothing saved; the checker's open page shows it **by itself** ("Approvals (1)");
  "Approve ticked" → saved as the maker's; the maker's open page shows Approved by itself; no page error. Looked at the rules panel
  in a screenshot.
* Old browser tests: billed108 24 / 24, lang110 17 / 17 (all pages in Marathi, no page error), entry71 20, shift109 8, tanker107 8,
  idle 10, half 12, item2 13. `settings.js` crashes at the same place on the main code too (not caused by this).
* `node --check` on server/*.js and api/*.js; every script block of the page parses (unit test).

## Not verified
* Not run on the live sites. The rules are empty until the Super Admin sets them: **nothing changes for anyone until then**.
* Needs SQL step 1z (update-108) at every site – it is already a step of update-108. Where it is missing, the Approvals page says so.
* The phone app: a save under a rule gets the message "Sent for verification …" – the app shows it as a message, but it does not
  yet treat it as "sent" (green, form emptied) and has no Approvals screen. That is the next phone version (3.1.7).
* Translations of the new texts were made by me (AI).
* Speed: every save reads the rules once (one small read); a diesel issue also reads the waiting requests (one table read).

## Going back
Vercel → Instant Rollback to update-112. Requests still waiting stay in `billed_changes` (Kind "Flow") and are simply not shown
by the older code; their entries are not saved. The rules stay in `app_settings` and are ignored.
