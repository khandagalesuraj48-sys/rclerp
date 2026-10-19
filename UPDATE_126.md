# update-126 – Every number of the Diesel dashboard opens its entries (19-10-2026)

**Asked (with a picture of the Dashboard):** "ha iamge bgh dashbord war opening closing received je numbers aahet n nantr khali bgh
issued today mhanje he jo dashbord aahe ya waril kuth hi click kel ki tyanchi entryies open hotil ek mast motha dialogbox open hoil
tyatach entry open hotil fkt show hotil as banaw perfect".

## What changes (the page only)
* The nine numbers of the Diesel dashboard can be clicked, or opened with Enter:
  * the five cards: Opening stock, Received (inward), Issued to machinery, Closing stock, Stock now (live);
  * the four small ones: Issued today, Machines fuelled, Issue entries, Average per entry.
* On hover a card shows "See the entries ›" (on a phone it is always shown).
* A click opens **one big box** with what makes that number. It is **only shown**: there is no box to type in, only × and Close.
  * Its title, its dates (the Dashboard's own), and the number in big. **The box's number is the number on the card**, and its
    total row is the same.
  * **Opening stock / Closing stock:** each diesel place – Opening + Received from pump + From another place − Sent to another
    place − Issued = Closing, and All places. These are the Dashboard's own figures (getDashboard), so no extra call.
  * **Stock now (live):** each place – its stock now, its tank size, how full.
  * **Received (inward):** the Diesel Inward entries of the dates – date, inward number, place, pump, bill number and date, litres,
    rate, amount, entered by. An opening stock entered on or before the start date is part of the opening, not "received", as
    getDashboard counts it.
  * **Issued to machinery / Issue entries / Average per entry:** the Diesel Issue entries of the dates – date, shift, entry,
    machinery, type, owner, from, litres, KM / Hrs reading, driver, remark, entered by. For the average, the total ÷ entries.
  * **Issued today:** today's Diesel Issue entries.
  * **Machines fuelled:** machine by machine – entries and litres.
  * More than 500 issue entries (the server's list): the latest 500 are listed, and the box says the total is of all.
* Closes with ×, Close, Esc or a click outside it.
* On a phone the box fills the screen and each entry is a card, its names on the left and values on the right.
* The assistant's button is hidden while the box is open.
* **The same access as before:** the entries come through the pages' own server actions (getInwards – Diesel Inward,
  getDieselIssues – Diesel Issue). A person without that page is told so in the box. The places' stock is the Dashboard's own.
  No new server action, no server change, no SQL, nothing written.
* The ownership rows below (Own / Rental / …) still open their machine-wise list as before.
* The Dashboard's help (the ? button) says it, in English / मराठी / हिंदी.
* The new words were added to Marathi / Hindi (`mr.json`, `hi.json`); `keys.json` was refreshed by `tools/i18n/extract.js`.
* The phone app: the same, in its own sheet (rcl-mobile App 3.21.0).

## Evidence
* **Unit tests: 89 / 89** (run 3 times). The new test "update-126" checks:
  * the nine numbers can be pressed (click and Enter), and the box has nothing to type in;
  * only getInwards and getDieselIssues are called, and their access is as before;
  * the page's own code worked through with sample answers – every total, the opening stock left out of "received", today's
    dates, the average, machine by machine, the "latest 500" note;
  * the help in three languages.

  On main the test fails.
* **Browser `test/browser/dashkd126.js`** (local rig – never the live database; it adds one machinery and one diesel issue of
  today, and takes them out at the end): **72 / 72**.
  * For **All dates, This month and Today**, every one of the nine numbers: the box opens on top, read-only, and its big
    number = the card's. The total row = the card. One line per entry. The bills and the amount = the card. Today's entry is in
    "Issued today".
  * Esc, a click outside and × close it; Enter opens it.
  * The ownership list still opens.
  * Phone 390 × 844: the box fills the screen.
  * A user with the Dashboard but without Diesel Issue: the box says so and shows no entry; the places' stock is shown.
  * No page error.

  The same test on main: the numbers cannot be opened.
* `node --check` passes on `server/*.js` and `api/*.js`, and the page's 6 script blocks parse. No secret is in the change.

## Not run / not verified
* Not tried on the live site or on a real phone. The rig's data is small (6 issue entries), so the "latest 500" case was checked
  only in the unit test.

## Going back
Vercel → Instant Rollback to the deployment before this one. Nothing in the data changes.
