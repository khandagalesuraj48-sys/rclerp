# update-219 – The new menu: a module rail + the chosen module's pages, closed by a pick (no SQL) (10-11-2026)

**Asked:** with more modules (Machinery, Store, Engineering, Purchase …) the long menu took too much scrolling to reach another module.
He saw the designs (Design artifact "ERP Navigation Options") and chose **Option A**: "mi option a choose kre … mechanical war click kel ki
lagech sagle open hoil submenu eka khali ek, war search pn asel, ctrl k pn aahech … submenu madhe kashya war click kel ki submenu close
hoyla hawa, jasa aahe tas motha rahu naye … sub menu open zal ki screen adjust auto hoyla hawi, close zali adjust auto … jewa submenu open
hoto tewa ek effect haway open and close cha".

## What changes (App.html only – the look and the way to reach a page; every page, its access and its work as before)
1. **The rail** (`#mrail`, always on the left on a computer): the logo, **Change site**, one button for **Machinery**, one for each of **his
   modules on this site** (the Portal's list – Store, Engineering, Purchase …), **Admin** (only for an Admin, as before), **My account** at
   the bottom. A module with a page that has a badge / dot gets a red dot; the module of the open page is yellow.
2. **One click on a module → all its pages at once**, one below another (`#smenu`; the old sections – Master, Diesel, Log Book, Billing,
   Reports … – are headings now, nothing to open first), with a **"Find a page…" search box** on top (it keeps only the pages whose name has
   every word typed; Enter opens the first). **Ctrl + K** is unchanged.
3. **A page picked → the pages close by themselves** (also: the module's button again, the « button, a click anywhere outside – also inside a
   module's page shown in the middle –, Esc, opening another page with Ctrl + K / Back, signing out).
4. **The screen adjusts by itself**: on a computer the pages open BESIDE the rail and the page next to them narrows (1356 → 1080 px on a 1440
   px screen); closed, the page has its whole width again. **The open / close effect**: the pages slide open and shut (0.22 s) and their
   content comes in from the side, fading (reduced-motion settings: no movement).
5. **A phone / tablet browser (≤ 760 px)**, as the design's phone picture: the modules are a **bar at the bottom** (the page keeps the whole
   width of the screen); a module's pages slide **up as a sheet** over the page with a shade; a page picked or a tap on the shade closes it.
   (This replaces update-209's "push back" of the page on a phone.)
6. The page buttons are **the same buttons** as before (the same ids, handlers, access rules, badges) – only moved into the panel. The old
   "slim / wide menu" button is not shown any more (the rail is always slim, the names are in the panel); a slim menu kept on a device from
   before is not put back.

New words in Marathi and Hindi: "Find a page…", "Close the pages", "No page found". The phone app is not changed (its own screens).

## Evidence (local test copy, test data only – nothing saved)
* Unit tests: 172 / 172 (`update-219`: the rail and the panel, every page button of before still there once and inside the panel, the looks,
  the closing ways, the rail following the menu, the search never touching a page's "hidden" (that is the access rule), the phone's bar and
  sheet, the words in 3 languages; `update-209` changed: its push back is gone).
* Rig browser test `test/browser/nav219.js` (signed in through the Portal → Mechanical, site S1): **14 / 14** – the rail (Machinery,
  Engineering, Purchase, Admin, My account); closed = whole width; Machinery → 39 pages at once, the search box, the page narrower; "diesel"
  → 9 pages, Enter opens the first and closes; a page picked → closed, Machinery marked; the button again / Esc / a click outside → closed;
  Engineering → its pages only, one picked → closed; Ctrl + K opens; a phone: the bar at the bottom (390 × 62 px), the page 390 px wide, no
  word broken in two, the sheet above the bar with the shade, a pick / a tap on the shade closes; no error on the page.
* Pictures (computer and phone): sent with the pull request.

## Not verified
* On the live site and on a real phone / iPhone (only the test copy, in Chromium).
* The live Store's / Engineering's / Purchase's own page lists in the panel (on the test copy their menus are short – "Open Engineering").

## Going back
Vercel → Instant Rollback to the update before. No database step.
