# update-101 – the dark menu scrolls by itself; Ctrl K finds the Store too (13-10-2026)

**Asked (13-10-2026):**
> "kali patti scroll kel ki side bgh kashi blank aste … kali patti scroll je ahe tyach logic wegle asave ani baki jo bhag
> scroll hoto tyach logic wegle … white portion side la dise naye"
>
> "search ctrl k new modual la search krt nahi … item as lihle tri kahi nahi ale … new task kahi add zal tr search ha proper full
> in built asel"

## What changes
* **The dark menu, on a computer:**
  * it stays on the screen at full height and has its **own scroll**;
  * scrolling it never moves the page, so nothing empty shows beside it;
  * the page beside it scrolls by itself and the menu stays.

  The phone menu (drawer) is unchanged.

  On 02-10-2026 he had asked for the menu to be part of the page and scroll away with it. That is what left the empty part
  beside a long menu. It is replaced now, as asked today.
* **Ctrl K search also searches the other modules of the screen (the Store):**
  * their **pages** (Store › Dashboard, Item Master) are listed among the pages, at once;
  * their **entries**: the Store's Item Master (code, name, category, HSN, unit, status). All words must be found; with nothing
    found, a spelling mistake is allowed (two swapped letters count as one).
  * A found item opens **Store › Item Master in the same screen**, showing that item.
  * Mechanical's own search is unchanged.
* **Built in for modules added later:**
  * each module's page gives `window.rclModule = { search(q), open(page, find) }`, and Mechanical asks every module of the
    screen through it;
  * a new module that gives these two is searched with no change in Mechanical;
  * its pages come from its `menu.json`, as for the menu.

  The first search loads the module's page out of sight, and it signs in by itself.

No SQL. Bills, ledgers, stock and permissions are unchanged.

## Evidence (local rig; never live)
* **`test/browser/search101.js`** (rig `GATEWAY=1 PORTAL=1`): **10/10**.
  * The menu is sticky, at full height, and its list scrolls by itself (page scroll stays at 0).
  * The page scrolls by itself while the menu stays.
  * Ctrl K "item master" finds the Store's page.
  * "hydraulic pump" finds the item, also by its code and with spelling mistakes ("hydrolic pmup").
  * A click opens Store › Item Master showing only that item.
  * "diesel issue" works as before.
  * One tab, no script error.
* **Mechanical:**

  | Test | Result | Note |
  |---|---|---|
  | unit | 65/65 | new "update-101" |
  | inframe100 | 11 | |
  | portal91 | 22 | |
  | site90 | 24 | |
  | pwa | 9 | |
  | start | 8 | |
  | search83 | 13 | |
  | mobile86 | 18 | phone menu |
  | tanker97 | 16 | |
  | sweep | 38 / 38 pages ok | |
  | topbar | nothing spills | |
* **Store:**

  | Test | Result | Note |
  |---|---|---|
  | unit | 10 | new: search / open, spelling allowance |
  | api | 46 | |
  | browser | 26 | |
* The script blocks parse and no secret is in the change.

## NOT verified
* Live, and in the installed app on his devices.
* The menu was not tested at other computer sizes than 1440×760 / 1440×900. Phones keep the drawer (mobile86).

## Going back
Vercel → Instant Rollback (rclerp and rcl-store).
