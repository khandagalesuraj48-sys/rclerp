# update-237 – Diesel Day Book: every diesel entry of every place in one sheet (no SQL) (13-11-2026)

**Asked (13-11-2026):** "Day-wise diesel stock ethe … fkt total diste vehicle wise entry disat nahi ani eth filter aahe tr mala jo
report haway tyat filter nasel to purn data ekach report madhe detail show krel" – a period (1 to 12), date-wise: how much diesel
came and where, the same day to whom it was issued, to whom it was transferred; Today, Yesterday, a period. The picture was shown
and approved ("ho he ok aahe"); **web only now** – the phone app after its release ("app la release nantr kru pn karaych ahe").

## What is new
* A report **Diesel Day Book** in Diesel Reports (`rptDayBook` – module Reports, read only).
  * No place is chosen: every diesel place of the site is a column, side by side, plus "All places".
  * For each date with an entry: the **opening stock** of each place; **every entry on its own line** in the order the stock
    counts them – Inward (from whom → which place, bill, rate), Transfer (from → to: − in one place, + in the other, one line),
    Issue (machinery, its reading, driver, shift; − in the place it was given from); who entered it and when; the **closing stock**
    with the day's Inward / Transfer / Issued.
  * At the end the whole period. Today · Yesterday · This month, or From / To (it opens on today). Print and Excel as every report.
* Its figures come from the same stock events as the Stock Register and the Day-wise diesel stock (`events_`) – nothing is counted
  a second way. Hidden on a site on fuel cards (as the other stock reports).

## Files
`app/Code.gs` (`rptDayBook_`, `API_`), `app/App.html` (the report, its filter "days", its guide in three languages, its look),
`test/unit.test.js`.

## Evidence
* `timeout 300 node --test test/unit.test.js` – 186 pass (new: the Day Book by hand – opening, inward, a transfer as one line with
  − / +, issues, closing; the next day opens with the closing of the day before; the same closing as the Stock Register of each
  place; a period without entries).
* On the local rig (test data): the report opened from the menu, generated for a period with inward, issues and a transfer – the
  picture given to him.

## NOT run / NOT verified
The other browser / API tests were not run. Print and Excel of this report were not opened. The live site – his look after the deploy.
**The phone app has no screen for it yet** (his decision: after the app's release).

## Going back
Vercel → Instant Rollback to update-236.
