# update-80 – the sign-in screen as it was; only the logo is One Click Solution's (11-10-2026)

Live is update-79 (`11d9119`). Seeing update-79's new dark sign-in screen with his second picture, the owner said: "the main picture
that was there before (the girl) – keep it; update only the logo image". Asked which logo and which colour, he answered: **the
round logo (his first picture)** and **the form white as before**.

No database step, nothing to set in Vercel.

## What changes against update-79
| Place | update-79 | Now |
|---|---|---|
| Sign-in screen, left | his second picture (Finance / HR / Analytics) | **the picture of before** (the same link as up to update-78) |
| Sign-in form | dark-blue glass card, blue button; the logo only on phones | **white form as before** (button, fields, Rachana's logo, site name – all as up to update-78); on top of it his **round logo** (on every screen) |
| Browser tab icon, app icons, the opening | his logo (update-79) | unchanged – stays |
| Inside the app | nothing | nothing |

His second picture (`app/icons/oc-login.webp`) is not used any more: removed from the app (`git rm`, in the deploy steps).

## Files changed (against update-79)
| File | Change |
|---|---|
| `app/App.html` | the left picture back to the one of before; the dark sign-in look (CSS under `#login_screen`) taken out – only the logo's size and centring stay; the form's logo = `oc-logo.webp` |
| `app/icons/oc-logo.webp` | new – his round logo as it is (640 × 462, 64 KB), for the white form |
| `app/icons/oc-login.webp` | removed |
| `test/browser/logo79.js` | the sign-in checks follow his answer |
| `UPDATE_80.md`, `HANDOVER.md` | notes |

Checked: the sign-in screen's markup is the same as up to update-78 except the one line of the logo (compared with update-78).

## Evidence (local rig; every command with a time limit)
| Test | Result |
|---|---|
| `logo79.js`: tab and iPhone icons are the new files; the opening shows his logo; wide screen: the page asks for the same picture as before, the form white, all fields / links there, his logo on top; phone: the logo on top; after the sign-in nothing of it inside; no script error | 6 passed, 0 failed |
| `brand.js` 13 / 0 · `pwa.js` 9 / 0 · `sweep` (every page opened) 38 / 0 · `hardenpage` 10 / 0 · unit + net 56 / 56 | all passed |

## Not verified
* The left picture and Rachana's logo are links (cdn.21st.dev, ibb.co) the rig cannot reach – on the rig they do not show; the links
  are the same as before, so on the live site they show as before.

## Going back
Vercel → Instant Rollback → update-79 (`11d9119`).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-80.zip" -DestinationPath . -Force
git rm app/icons/oc-login.webp
git status
git add .
git commit -m "update-80: sign-in screen as before, only the One Click Solution logo"
git push
```
