# update-122 – The machinery number list on phones and tablets (17-10-2026)

**Asked:** "he bgh ethe vehicle number select kela tri disat nahi windows warun kel tr distey … android aso ios aso window aso kahi
aso web war aahe … iphone warti pn te disat nahi number je kahi aahe te fix kr patkan proper work hoyla haw".

## What was wrong (live since update-115, 15-10-2026)
* The machinery box of an entry – Diesel Issue, Log Book (one date and every row), Tank Check, Breakdown – lists only the machinery
  on site on the entry's date (`dl_mach_on`, update-115). That list is made when the box is touched (`machOnFill`), and the code
  that made it recognised the box by its `list` attribute.
* On a phone or a tablet the page shows its OWN list under the box (05-10-2026, `pkTake`), and for that it moves `list` to
  `data-pk`. So on every phone the box was no longer recognised, the list of the machinery on site was never made, and the app's
  own list had nothing to show: **no number to pick on Android or iPhone**. A computer keeps the browser's list and was fine.
* An iPad with a keyboard / trackpad and a big screen was taken for a computer, so it got Safari's own list – which Safari shows
  only in the keyboard's bar (nothing with a keyboard attached).

## What changes (the page only)
* The box is recognised by `list` **or** `data-pk`; the app's own list makes the machinery-on-site list before it reads it
  (`pkOptions` → `machOnFill`), so the numbers are there at the first touch, for the entry's date.
* Every iPad / iPhone (also an iPad with a keyboard, or one that says it is a Mac) gets the app's own list (`pkApple`).
* A Windows / Mac computer keeps the browser's list, as before. No server change, no SQL, no data touched.

## Evidence
* `test/browser/picklist122.js` (new, needs no rig – the page's own code cut out of App.html, in Chromium): as an Android phone,
  an iPhone and an iPad with a keyboard: the list opens under the box, shows the machinery on site that match "Sa" (not the one
  that left), a tap puts "Sany 210 (No.1)" in the box, no page error; a Windows computer: the browser's list, filled. **13 / 13**.
  The same file on the page before this update: **4 passed, 9 failed** – on the phones the list of the machinery on site was empty.
* Unit 85 / 85 (every script block parses). In one of three runs the old test "update-117" failed once at `saveTransfer` – a
  server test this change does not touch (only App.html changed); it passed in the other runs.

## Not verified
* On a real iPhone / iPad / Android phone (Chromium was made to act as each of them; Safari itself was not run).

## Going back
Vercel → Instant Rollback to the deployment before this one.
