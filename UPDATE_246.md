# update-246 – The lists of Diesel Issue, Inward and Transfer show WHEN each entry was saved (14-11-2026)

**Asked:** "web aso ki app aso user jewa diesel issue krto n tyach timing disayla pahije ki kiti wajta issue zalel aahe … entry wise
ani koni entry keley he pn … first view madhe te patkn disayla haway". After the pictures: "App sathi A asel, wel asel entry save
keleli realtime … he all thikani aasel log book diesel issue inward transfer".

**No database step. No entry, calculation, bill, ledger, stock or permission changes** – the lists only show one thing more.

## What changes
* **Server** (`app/Code.gs`): the rows of `getDieselIssues`, `getInwards` and `getTransfers` carry `at` – the moment of the first
  save ("Created At", which an edit never changes), on the site's clock, as `yyyy-MM-dd HH:mm` (`savedAt_`). An entry without it: `''`.
* **Web** (`app/App.html`): a column **Time** beside the date in the three lists (`atCell`): "09:42 AM"; when the entry was saved on
  another day than its own date (an entry of an earlier day, or one made after midnight for the day before), that day is shown under
  the time. "Entered by" stays as it was. The empty line and the totals line are one cell wider, as the heading.
* **Phone app** (`rcl-mobile` 3.123.0, its own pull request): under every card of the three lists a line – the time on the left,
  "Entry: <who>" on the right (his choice A).

## NOT done – the Log Book
The Log Book has no "Created At" among the columns the app reads (only who entered and who changed), so there is no time to show.
The database keeps its own `created_at` for a Log Book row, but for the rows that were there before the move to Supabase it is the
time of the move, not of the entry. Showing it needs his decision (see the pull request) – nothing of the Log Book is changed here.

## Evidence
* `timeout 300 node --test test/unit.test.js` – 192 of 192 pass (the new test "update-246": the server's time in India time; the
  cell for morning, afternoon, midnight, noon, another day, a damaged value; the three headings, cells and widths).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse (unit test).

## Not verified
* Not seen in a browser and not run against a database: the API and browser tests need the local copy, which was not started.
* The phone app: built and tested only by GitHub Actions – see its pull request.

## Going back
Vercel → Instant Rollback to the update before. Nothing is stored differently, so nothing has to be undone in the database.
