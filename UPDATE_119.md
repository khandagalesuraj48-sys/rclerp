# update-119 – A machinery on a site several times (it left and came back) (16-10-2026)

**Asked:** "vehicle ali first time active aste nantr jate inactive hote nantr part ali kahi months nantr tr ti prt active kryla
lagte tr maal period wise active inactive hawey jene karun problems yenar nahit … active inactive cha effect log book diesel issue
ase thikani hoto … ekadi gadi active hotil bill te sagle zaly draft madhe bill ahet nantr ti geli band inactive zali 2 month sathi
tewa tich kahich nasnar jr ti prt ali tich record prt jya date pasun ali tewa pasunch tich prt sagle chalu hoil … all site la lagu".

## How it works
* A machinery keeps **every period it was on the site**:
  * its **current** period – Active From / Status / Inactive From in the Asset Master, exactly as before;
  * its **earlier** periods – when it left and came back – kept with it ("Earlier periods on site").
* **It came back:** Asset Master → Edit → Status **Active** → the page asks **"Did it come back to the site?"**
  * **It came back on <date>** (on or after the day it left): its period until it left is kept as an earlier period, and
    from that date everything goes on again (Log Book, diesel, pending, bills, reports) – nothing of before changes;
  * **It never left** (the Inactive was a mistake): the Inactive is taken away and every day counts as on site – as before.
  * The list of changes before saving says which one ("It came back: left on 01-07-2026 → back on 01-09-2026 …").
  * The same in **Edit selected** (several at once): a new field "Active From (made Active again: the day it came back)";
    made Active without it → asked "They never left the site?" first.
* **The days it was away** count as after Inactive From: no Log Book or diesel entry (the message says "PR-119 was not on this
  site from 01-07-2026 to 31-08-2026 (it came back on 01-09-2026)"), not in the pending Log Book, not offered in the pickers of
  that date, not in the "On site" dates of the Asset Master, no rent days for them (Breakdown / On site reports).
* **Bills:** a bill period in which it left (its current Inactive From, or an earlier period that ended in it) is its final bill
  as before ("the diesel in its tank left with it"); bills already made are not changed.
* **Entries stay safe:** a change of these dates (Inactive From, Active From, the earlier periods) that would put entries already
  made off site is refused: "CB-119 has entries on 10-03-2026 (Diesel Issue) – with these dates it would not be on site then.
  Change the dates, or first delete those entries."
* The earlier periods can be seen under the Active / Inactive badge of the list ("earlier: 01-01-2026 – 30-06-2026") and
  corrected in the form (From / Inactive From, + Add an earlier period, Remove) – checked: in order, not overlapping, before the
  current period.
* The phone app (3.1.12) follows the same rule (pickers by date).

## How it is built
* **SQL step 1za (needed, every site):** `sql/supabase_step1za_site_periods.sql` – adds one empty column `master.site_periods`
  (text). It only adds. Until it is run: everything works as before, but saving a machinery that came back is refused with the
  usual "run the pending SQL step" words (nothing is half-saved). The Admin's "Database" check names it; a New site gets it.
* `app/Code.gs`: `parsePeriods_`, `periodsOf_`, `onSiteOn_` (all periods), `assertActive_` (the words), `sitePeriodsSave_`
  (came back → kept; checks), `assertEntriesStay_`; used by `saveMaster_`, `editMasterMany_`, `importMaster_`; the pending Log
  Book and Log Book dashboard days and the final-bill rule use the periods. `getMaster_` gives `earlier`.
* `app/SupabaseSync.gs`: the column. `app/ReadMe.gs`: the step, word for word.
* `app/App.html`: `mPeriods` / `onSiteOn` / `onSiteIn` / `siteSpan` / `activeProblem` (= the server), the form (earlier
  periods, "did it come back?"), Edit selected, the badge, the bill rule (page = server). FIX_RULES: one rule for the new words.

## Evidence (local rig, test data only)
* Unit 83 / 83 – new "update-119": an Inactive From that would put an entry off site refused; it came back (a date before it left
  refused; on 01-09 kept: `[{"from":"2026-01-01","until":"2026-07-01"}]`); on site by date (7 dates); entries in both periods
  saved, in between and before refused with the words; pending Log Book only its days on site; the earlier periods corrected
  (checks, one with entries cannot go, a correction that keeps the entries); "it never left"; Edit selected; getInit carries it;
  page = server (on site, in a range, site days, the words, the bill rule); the SQL step (only adds, listed word for word).
* Browser `test/browser/periods119.js` 13 / 13 (the step run on the rig's databases): the form's question, the change list, saved
  with its earlier period, the badge and the form, the Diesel Issue picker by date (15-06 yes, 15-08 no, 05-09 yes), the page's
  and the server's words, the Asset Master dates; no page error. Screenshot looked at.
* Old browser tests: inactive115 11 / 11, lang110 17 / 17, flow116 18 / 18. master75.js stops at "Users and access are given by
  the Super Admin only" on the main code too (the rig is in Portal mode).
* `node --check` server/*.js, api/*.js; page script blocks parse.

## Not verified
* Not run on the live sites. **SQL step 1za must be run in every site's Supabase (VTR, 18B) before a machinery that came back
  can be saved.**
* Old machinery whose Inactive was simply taken away earlier (before this update) have no earlier period: their days away count
  as on site, as they do today. If needed, add the earlier period in the form (+ Add an earlier period).
* Translations of the new words were made by me (AI).

## Going back
Vercel → Instant Rollback to update-118. The column stays (empty or with the periods); the older code ignores it – a machinery
that came back then counts as on site only from its new Active From (its earlier days lose their "on site").
