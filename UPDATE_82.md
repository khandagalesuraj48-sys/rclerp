# update-82 – the app icon / browser-tab icon is his picture (the mark on a light background) (11-10-2026)

Live is update-81 (`70ce8e6`). The owner sent the One Click Solution mark on a light background: "the favicon, the app picture – I
want this one; app picture means the icon, the app icon".

No database step, nothing to set in Vercel.

## What changes
The icon in the browser tab, the installed app's icon (phone home screen, computer), the iPhone icon and the call notification's
icon: his picture – the mark on its light background (#F7F7F7), cut from his file without the faded words under it, rounded where
the device does not round it itself. Before (update-79): the mark on dark blue.
Nothing else: the opening, the sign-in screen and everything inside the app as they are.

The files have new names (`oc2-…`): the app keeps its icons once fetched, so a phone that has the dark one gets the new one by its
new name. The dark ones (`oc-icon-…` of update-79) stay in the folder, not used.

## Files changed (against update-81)
| File | Change |
|---|---|
| `app/icons/` | new: `oc2-favicon-64.png`, `oc2-icon-192.png`, `oc2-icon-512.png`, `oc2-maskable-512.png`, `oc2-apple-180.png` |
| `server/page.js` | tab icon and iPhone icon → `oc2-…` |
| `build.js` | the manifest's icons → `oc2-…` |
| `app/sw.js` | the kept icons and the notification icon → `oc2-…` |
| `test/browser/logo79.js` | checks the new file names |
| `UPDATE_82.md`, `HANDOVER.md` | notes |

## Evidence (local rig)
| Test | Result |
|---|---|
| `logo79.js`: the tab icon `oc2-favicon-64.png` (64 × 64) and the iPhone icon `oc2-apple-180.png` (180 × 180) load; the rest as before | 6 / 0 |
| `pwa.js`: manifest icons 192, 512 and maskable 512 load with their stated sizes; the iPhone icon | 9 / 0 |
| unit + net | 56 / 56 |
| the five icons looked at side by side | the mark centred, nothing cut off |

## Not verified
* A real phone: an installed app may keep showing the old icon for a while; on an iPhone it changes only when the app is removed
  from the Home Screen and added again.

## Going back
Vercel → Instant Rollback → update-81 (`70ce8e6`).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-82.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-82: app icon - the One Click Solution mark on light background"
git push
```
