# update-79 – One Click Solution's own logo (app icon, opening) and the sign-in screen in its look (11-10-2026)

Asked by the owner on 11-10-2026, with two pictures: the One Click Solution logo ("from the favicon to the start logo – this one")
and a picture for the sign-in screen ("look at it well and design it"); "after the sign-in our logo does not show".

No database step, nothing to set in Vercel. Live is update-77 (`73b503a`). **This zip also carries update-78** (rows by Time and by
Hrs in one shift – `UPDATE_78.md`), which was not pushed yet: pushing this one zip brings both.

## What changes (only before the sign-in)
| Place | Before | Now |
|---|---|---|
| Browser tab icon (favicon) | the Rachana logo, loaded from a picture site (ibb.co) | the One Click Solution mark, a file of the app itself (`/icons/oc-favicon-64.png`) |
| App icon (installed app, phone home screen, iPhone, call notifications) | yellow drop "FLEET ERP" | the One Click Solution mark on dark blue (`oc-icon-192/512`, `oc-maskable-512`, `oc-apple-180`) |
| Opening (plays once when the app is opened) | a drawn mark and the words ONE CLICK SOLUTION | his logo, glowing, on the dark-blue stage; the line and the "for Rachana Construction Limited" stay |
| Sign-in screen | a stock picture on the left, a white form | **his picture** on the left; the form in a dark-blue glass card – white text, dark fields, blue glowing **Sign In** button; Rachana's logo on a white plate and the site name as before. On a phone: the logo on top of the card, his picture faintly behind it |

**After the sign-in nothing changes**: the side bar keeps Rachana's logo and "by One Click Solution"; no page inside was touched.
The name of the app ("Fleet ERP") is not changed.

## Files changed (against update-78)
| File | Change |
|---|---|
| `app/icons/` | new: `oc-favicon-64.png`, `oc-icon-192.png`, `oc-icon-512.png`, `oc-maskable-512.png`, `oc-apple-180.png` (the mark from his logo on dark blue), `oc-logo-glow.webp` (his logo with a soft light halo so its dark-blue words read on dark), `oc-login.webp` (his sign-in picture, 1672 × 941, 173 KB). The old icons stay (an installed app may still ask for them) |
| `app/App.html` | the opening and the sign-in brand show the logo; the sign-in picture; the sign-in look (CSS, all under `#login_screen` / `#oc_intro` – nothing inside the app) |
| `server/page.js` | the tab icon and the iPhone icon → the new files |
| `build.js` | the app's icons in the manifest → the new files |
| `app/sw.js` | the kept icons and the call-notification icon → the new files (new names, so a phone that kept the old icon gets the new one) |
| `dev.js` | (local rig only) serves `.webp` from `/icons/` – Vercel serves every file of `public/` by itself |
| `test/browser/brand.js` | the opening and the sign-in brand are a picture now – checked by the picture (changed on purpose) |
| `test/browser/logo79.js` | new |
| `UPDATE_79.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit)
| Test | Result |
|---|---|
| `logo79.js` (real pages, 1366 × 768 and a 390 × 844 phone): the tab icon and the iPhone icon are the new files (64 × 64, 180 × 180); the opening shows the logo (700 px, loaded), the drawn mark is gone; wide screen: his picture loaded on the left, the dark-blue card, the blue button, every field / link of the form still there, the logo not twice; phone: the logo on top of the card; after the sign-in the sign-in screen is gone, Rachana's logo in the side bar, no One Click Solution picture inside; no script error | 6 passed, 0 failed |
| `pwa.js`: manifest and real icons of the stated sizes (192, 512, maskable 512) and the iPhone icon | 9 / 0 |
| `brand.js` (changed on purpose, see above) 13 / 0 · `hardenpage` 10 / 0 · `sweep` (every page opened) 38 / 0 · `least68` 9 / 0 · `retry` 10 / 0 · `fix` 8 / 0 · unit + net 56 / 56 | all passed |
| Screenshots looked at: opening, sign-in at 1920 × 1000, 1366 × 768 and a phone | as described above |

## Not verified
* Rachana's logo itself on the new card: it is loaded from ibb.co, which the rig cannot reach – the screenshots show its fallback
  name in the white plate. On the live site the logo loads as now.
* A real phone's home-screen icon: an installed app takes a new icon only when the phone refreshes it – that can take a while, and
  an iPhone keeps the old icon until the app is removed and added to the Home Screen again. Not tried on a real phone.
* Not run again for this update: the Log Book / bill browser tests (nothing of them was touched – they all ran on update-78).

## Going back
Vercel → Instant Rollback → the deployment before. Nothing is stored by this update.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-79.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-79: One Click Solution logo and sign-in look (with update-78: Time and Hrs rows in one shift)"
git push
```
Vercel "Ready" → close the app tab and open the address again (the opening plays once per browser session).
