# update-81 – the sign-in screen shows One Click Solution only (11-10-2026)

Live is update-80 (`904c0c3`). Asked by the owner on 11-10-2026, with the screen of the sign-in design it was made from (the picture
on the left, the white form): "I want it the same – that girl's picture; on the login page there is no Rachana name: One Click
Solution and One Click's logo".

No database step, nothing to set in Vercel.

## What changes
* The sign-in screen: Rachana's logo and the site line under it ("VTR Site – NH 848") are taken off. On it now: the picture on the
  left (as before), One Click Solution's logo, "Welcome Back", the fields and Sign In – as before. A little more space under the logo.
* Nothing else. Not changed (said plainly, they still carry the customer's name): the browser tab's title ("Rachana Construction
  Limited – Fleet ERP · One Click Solution") and the line under the logo in the opening ("Rachana Construction Limited · VTR Site –
  NH 848"); inside the app everything as before.
* Not added from the design he showed: its back arrow and "Continue with Google / GitHub" buttons – this app has no such sign-in.

## Files changed (against update-80)
| File | Change |
|---|---|
| `app/App.html` | the sign-in form: the `lp-brand` line (Rachana's logo + site) removed (the code that fills it already checks it is there); 22 px under the logo |
| `test/browser/brand.js`, `test/browser/logo79.js` | check that the sign-in screen has no Rachana name or logo (changed on purpose) |
| `UPDATE_81.md`, `HANDOVER.md` | notes |

## Evidence (local rig)
| Test | Result |
|---|---|
| `logo79.js` – wide and phone: the picture of before, the white form, One Click Solution's logo, no Rachana name or logo on the sign-in screen, after the sign-in Rachana's logo in the side bar as before | 6 / 0 |
| `brand.js` 13 / 0 · `sweep` (every page opened) 38 / 0 · unit + net 56 / 56 | passed |
| `hardenpage.js` | 9 / 1 when run right after `sweep` (the check "a page that really died: the note is shown at the next start" – a timing check of the page's own watchdog, nothing of the sign-in screen); run again on its own: 10 / 0 |

## Going back
Vercel → Instant Rollback → update-80 (`904c0c3`).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-81.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-81: sign-in screen shows One Click Solution only"
git push
```
