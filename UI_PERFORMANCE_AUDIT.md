# RCL Fleet ERP – Phase 2: screens and speed (01-10-2026)

`AUDIT.md` (Phase 1) is unchanged. All Phase 1 fixes are still in place and their tests were run again on this code.

Where it was measured: the local copy of the stack (PostgreSQL + PostgREST, two app servers), headless Chromium, test data
of 122 machinery / 3,606 Log Book rows / 1,809 diesel issues. **Not measured on the live Vercel deployment, on real phones
or on the live database.** The sandbox has one slow CPU core, so milliseconds are for comparing before and after, not for
predicting a laptop.

## What the app is built with (checked, not assumed)

One HTML page (`app/App.html`, about 10,000 lines of plain JavaScript and CSS – no React, no build step, no npm packages),
shown inside a shell page (`app/Index.html`). It talks to one endpoint (`/api/rpc`). So "re-renders", "bundle size" and
"component splitting" do not apply here; the things that can be slow are: calls to the server, drawing long tables, and
the once-a-second check.

## A. Speed – what was found, with numbers

| # | Finding | Before | After | How it was measured |
|---|---|---|---|---|
| P1 | The page asked the server "anything changed?" once a second, always (`SYNC_MS = 1000` in `startSync`). | working: 19 calls / 20 s · nobody touching the page: 29 calls / 30 s · tab in the background: every 8 s | working: 11 / 20 s · untouched: 6 / 30 s · background: every 30 s | request log in Chromium (`gap.js`) |
| P2 | Opening Diesel Issue asked the same question twice (`getIssueBalance`). | 1 repeated call over all 35 pages | 0 | request log per page (`base.js`) |
| P3 | The three pills in the top bar (database, backup, Live) were rebuilt on every check. | rebuilt every second | rebuilt only when their content changes | code change; no separate measurement |
| P4 | Drawing long lists in pieces (tried). | Log Book 509 ms, Activity 203, Diesel 281, Asset 136 (median of 3) | 508 / 211 / 520 / 180 – **no gain** | timer-gap in Chromium. **Removed again.** |

P1 in words: while someone is working, another user's change now shows within 2 seconds (was 1). On an untouched page it
shows within 5 seconds, after 5 minutes within 15. The first touch after a quiet spell, coming back to the tab, and every
save still ask at once – so nobody acts on old figures. For one tab open 8 hours this is roughly 28,800 calls before and
6,000–14,000 after, depending on how much the page is used.

Where the remaining time goes (Chromium timeline, Diesel Issue page with 500 rows): **layout 203 ms + style 168 ms + paint 201 ms,
script only 21 ms**. It is the browser laying out a 500-row table (18,000 boxes), not the app's code – which is why P4 did
nothing. The only real cure is to show fewer rows at first (for example the latest 100 with "show all"); that changes what
people see, so it is listed under decisions, not done.

Not found (looked for): timers or listeners that pile up, calls in a loop, repeated calls on page changes (37 calls for 35 pages).

## B. Screens – what was changed

| # | Defect | Fix | Check |
|---|---|---|---|
| U1 | On a phone (390 px) three pages pushed the whole page sideways: Asset Master (+140 px), Log Book Format (+34 px), Machinery Billing (+507 px). | Their grids wrap on small screens. | all 35 pages: none spills (`base.js phone`) |
| U2 | On a phone the Log Book entry was a 1,511 px table inside a 338 px box. | One entry = one block that fits the screen (same fields, same code). | 340 px in 340 px; screenshot |
| U3 | Dialogs could be taller than a phone screen. | Capped at 88 % of the screen height, scroll inside. | style rule; not tried on a real phone |
| U4 | Tables, fields and buttons had drifted apart page by page (different header colours, focus marks, borders). | One set of rules for every table header, row hover, field border, focus ring and disabled button. | page sweep + screenshots |
| U5 | (from the earlier updates, kept) menu opened by a click, one-line Log Book entry, short diesel history, larger forms. | – | – |

Not done on purpose: a ground-up redesign of every page. Two larger redesigns were rejected after they went live (red menu,
boxed Log Book entry), so the look was made consistent instead of replaced. Bigger changes are listed below for approval.

## C. Files changed in Phase 2

| File | What |
|---|---|
| `app/App.html` | P1 (polling rhythm in `startSync`), P3 (pills), U1–U4 (styles at the end of the LOOK 2026-10 block) |
| `server/page.js` | P2 (a question already on its way is not sent again; saves are never merged) |
| `UI_PERFORMANCE_AUDIT.md`, `HANDOVER.md` | documentation |

No SQL, no schema change, no change to any calculation, permission, API name or answer.

## D. Tests run on this code

| Test | Result |
|---|---|
| `npm test` | 7 passed, 0 failed |
| `node test/audit.js` (permissions, sign-in limit, backup sign-in, double save, all-or-nothing save, ledger) | 40 passed, 0 failed |
| `node test/reg.js` | 11 passed |
| `node test/bkg.js` | 21 passed |
| all 35 pages, desktop: script errors / failed calls / sideways spill | none |
| all 35 pages, phone width: sideways spill | none |
| hostile text on every page | never ran |
| entry, edit, Edit Log Book, billing through the page (jsdom) | no errors; bill figures unchanged |

NOT RUN: real phones and tablets; Safari / iOS; the live deployment; printing; screen readers.

## E. Needs your decision

1. Long lists: show the latest 100 rows first with a "show all" button? This is the one change that would make long pages open clearly faster.
2. Polling rhythm (2 s / 5 s / 15 s / 30 s): say if another user's change must show faster or may show slower.
3. Phone Log Book entry as blocks: keep, or go back to the sideways table?
4. Menu: slim strip + click to open (now) or always open with names (uses 270 px of width)?
5. Real speed on Vercel is still unmeasured. Rest the mouse on "Live" after a slow click and send what it shows.

## F. Deploy

1. Supabase: run `sql/supabase_step3_safety.sql` (Phase 1; skip if already done).
2. Vercel: add `CRON_SECRET` (Phase 1; skip if already done).
3. Unzip the update over the folder, `git add -A`, `git commit`, `git push`.
4. Open the app, sign in, open Log Book and Diesel Issue once on the computer and once on a phone.
