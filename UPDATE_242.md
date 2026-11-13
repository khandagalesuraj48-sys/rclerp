# UPDATE 242 – A sideways scroll bar at the bottom of the screen for wide tables; two fingers sideways no longer go a page back (14-11-2026)

**Asked:** "web madhe web erp aso ki hr aso khali slider de roller patti ji slide krta yeil" – and, asked which one: the sideways
bar for the wide tables.

## Why
A wide table (Log Book, Diesel, the reports, the registers) has its sideways scroll bar at its END. With many rows that end is
far below the screen: to see the columns on the right one had to go to the bottom of the table first.

## What changed (`app/App.html` only)
One small script at the end of the page. While a table that is wider than its box has its end below the screen, a bar stands at
the bottom of the screen, as wide as that table: its handle is slid (mouse or finger) or the track is pressed, and the table
moves; the handle follows when the table is moved in any other way. When the table's own bar comes into sight the bar goes. It
is drawn by the page itself (the same in every browser), is not printed, and stays under the dialogs.
Nothing of a table, an action, a calculation or the data is touched; no server file; **no SQL**. The same script is in HR
(`rcl-hr/public/hsb.js`).

## Two fingers sideways (asked the same day)
"laptop war … 2 finger ni swipe kel ki browser back page la nete … he block kraych aahe back button dable trch back hoil": the page
and its outer frame (`app/App.html`, `app/Index.html`) tell the browser not to treat a sideways slide that reaches the page's edge
as "back" / "forward" (`overscroll-behavior-x: none` – Chrome, Edge, Firefox; Safari 16 and newer). A wide table still slides
sideways. The browser's own Back button and Alt+← work as before.

## Evidence
* Unit tests: `timeout 300 node --test test/unit.test.js` – all pass (a new test for this update).
* The page's script blocks parse.
* The same script was tried in a browser on HR's muster on the local test set-up: the bar stands at the bottom, sliding the
  handle moves the table, a press at the track's end shows the last column, the handle follows the table (8 checks pass).

## Not verified
* **Not tried in a browser on this page (Mechanical)** – the local copy of its database set-up was not built for this. To be
  checked on live after the merge: Log Book or a report with many rows and columns → the bar at the bottom → slide it.
* A phone-sized window with the bar of tabs at the bottom.
* The two-finger slide on a real laptop pad (it cannot be made in a test browser): to be tried on live – Chrome and Edge.

## Going back
Vercel → Instant Rollback to the update before.
