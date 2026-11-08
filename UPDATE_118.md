# update-118 – The sender sees his entries in verification and reminds the approver (16-10-2026)

**Asked:** "jewa diesel issue krnara entry issue [karto] tewa tyala save distey tyala send to verification disayla haw … jewa t
entry sent verification krel tyala pn samajayla haw konti entry verification madhe aahe ani konte approval zale aahet tithch disaw
ani diesel issue sathi dashbord war tya user la disel ki konte entry pending aahet … jya pending aahe tyach reminder pn to pathau
shakel … entry wise or all send reminder dable ki … approval krnar aahe tyala push notification … jas same whatsapp la message
yete tas syteam live".

## How it works
* **"My entries in verification"** – a box at the top of the page where the entries were made (Diesel Issue, Diesel Inward,
  Diesel Transfer, Log Book, Asset Master, Vendor Master, Vendor BOQ, Machinery Payments, Machinery Billing, Breakdown, Vehicle
  Compliance) and on the **Dashboard** (all pages together). Shown only to a person who has such entries:
  * Waiting / Sent back / Approved / Not saved (counts);
  * each entry: number and time sent, what it is, **Waiting at <names> · level x of y · since <time>**, Sent back (with the
    question), Approved – saved (by whom, when), Rejected / Returned / Taken back – not saved;
  * waiting and sent back: always; approved and not saved: the last 7 days on a page, the last day on the Dashboard;
  * it changes by itself (the live sync of the Approvals list).
* **"Remind"** on a waiting entry and **"Remind all waiting (n)"**: the person(s) of the level it waits at get a notification
  **at once** (web; the phone app – see below). Nobody else at that level (only the sender himself) → the Super Admin.
  * The same entry once in 5 minutes – a second press says "VF-00001 was reminded at 13:14 – again after 13:19".
  * Each reminder is a step of the entry ("Reminded – Maker – to Checker"); the approver's Approvals row says
    "Reminded 2× by Mahesh · time"; an approver whose page is open sees "Reminder from Mahesh: VF-00012 – waiting for your
    approval." on the screen by itself.
  * Only the sender reminds, and only his own waiting entries. The Activity Log keeps "Verification – reminder sent by the sender".
* **Why a person may see "Save" although rules are set:** the rule's work is not ticked (people picked but the tick off), an "only
  when" (days back / litres) is set and the entry does not meet it, the rule is at another site, or the phone has an app older
  than 3.1.8. New: the Super Admin's rules panel **asks before saving** a work with people picked but not ticked ("Ticked off, but
  people are picked … its entries are saved at once … the button says Save").
* **Phone app 3.1.11** (rcl-mobile): the same box on Home and on the Diesel Issue / Inward / Transfer / Log Book forms, the list
  with "Remind" / "Remind all waiting"; the approver's phone gets a notification for each reminder (app open: within seconds;
  app closed: Android's check about every 15 minutes).
* **"Like WhatsApp" on a closed phone app** needs Google Firebase (FCM) – waiting for the owner's decision (it needs a Firebase
  project of his). The web already gets it at once (web push, where notifications are allowed).

## How it is built (no SQL step)
* `app/Code.gs`: action `remindFlow` → `flowRemindMine_` (lock; own Pending only; 5-minute gap `FLOW_REMIND_GAP_MS_`; Data:
  `remindedAt`, `reminds`, history step; `crNotify_` to the level or `crSupers_()`; bump "flow"); Activity Log case
  `flowRemindMine`; `crList_` gives `m`, `remindedAt`, `reminds`, `canRemind` for a verification entry.
* `app/App.html`: `FV_TABS`, `fvMine`, `fvHtml`, `fvDraw` (called by `crDraw`), `fvRemindSeen` (in `crLoad`); the Approvals row
  shows the reminders; the rules panel's question; PAGE_GUIDE (Approvals saves: `remindFlow`); Marathi / Hindi words.
* Existing FIX_RULES cover the new messages (unit test: coverage).

## Evidence (local rig, test data only)
* Unit 82 / 82 – new "update-118": the list gives the page of each entry and Remind only to the sender; the checks (nothing
  picked, another's entry, unknown entry); one entry → the approver's notification, the step, the Activity Log; again within 5
  minutes → not sent, said when; "Remind all" sends the others; after 5 minutes again; decided → not reminded; nothing waiting →
  said; the sender alone at the level → the Super Admin; the page's list and box (run on their own).
* Browser `test/browser/remind118.js` 13 / 13 (real Postgres, Portal Super Admin): the rules question (Cancel: nothing saved);
  the maker's Diesel Inward page and Dashboard boxes; "Remind" → the checker's open page tells it by itself and his row says
  "Reminded 1× by Maker 118"; "Remind all waiting (2)" → one sent, one "again after"; approved → the maker's box "Approved –
  saved" by itself; the inward saved; no page error. Screenshots looked at.
* Old browser tests: flow116 18 / 18, flow114 12 / 12, billed108 24 / 24, lang110 17 / 17.
* Phone app 3.1.11: GitHub build green (analyze, unit + screen tests incl. the new ones, goldens unchanged, Android).
* `node --check` server/*.js, api/*.js; the page's script blocks parse (unit test).

## Not verified
* Not run on the live sites; not on a real phone. The web notification needs the person to have allowed notifications
  (Settings → notifications), as before.
* The cause of "Save" at the owner's site is not seen (no access to the live data) – the likely causes are listed above.
* Translations of the new words were made by me (AI).

## Going back
Vercel → Instant Rollback to update-117. Reminders already written stay in the entry's data (ignored by the older code).
