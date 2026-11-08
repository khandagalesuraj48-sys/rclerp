# update-93 – module shortcuts in the top bar (13-10-2026)

Asked by the owner on 13-10-2026: the person signs in once on the main link (the Portal) and his ERP opens straight away. If he
has other modules, he changes module from inside the module, with **shortcuts in the top bar**. He can set his own
**default module**.

## What changes (only when Mechanical signs in through the Portal – `PORTAL_URL` is set)
| Where | What |
|---|---|
| **Top bar** | When he has **two or more modules on this site**, they show as shortcuts, e.g. `[ Mechanical | Store ]`. Mechanical is marked as open. A click opens the other module through the Portal, with no new sign-in. While an entry is still being sent, he is asked to wait. Next to the shortcuts, the "Modules" button keeps only its sign ▦; it still lists his other sites and "All my modules". |
| **With Mechanical alone** | No shortcuts – there is nothing to go to. They appear by themselves when Store, Engineering or another module is added in the Portal. |

The **default module** ("My start") and the **One Click Solution sign-in page** are on the Portal (its own pull request,
with one small SQL step there).

## Evidence (local rig – never live)
* `test/browser/portal91.js`: 20 / 20. New checks:
  * a second module ("Store", played by the other rig server) on S1;
  * the top bar shows `Mechanical*, Store`;
  * a click on Store opens Store on S1 with a ticket, with no sign-in.
* `test/portal91api.js` 40 / 40 · `test/unit.test.js` 61 / 61.

## Not verified
Not run on live. There is no second module live yet, so on live nothing new shows until one is added.

## Going back
Vercel → Instant Rollback to update-92.
