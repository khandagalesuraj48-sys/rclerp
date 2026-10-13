# update-91 – sign-in through the Portal (13-10-2026)

Asked by the owner on 13-10-2026: login moves out of Mechanical onto the Portal. The Portal checks who the person is and
shows his modules. A click opens the module. From inside one module he goes to another without going out. Sites and module
access are given in one place, the Portal.

Live: update-90. **No SQL step. One Vercel setting switches it on: `PORTAL_URL`.**
**Merging this changes nothing by itself.** Without `PORTAL_URL` the app signs in exactly as today. That was checked: a
server without the setting runs the old browser tests unchanged.

## What changes once `PORTAL_URL` is set
| Who / when | What |
|---|---|
| **Opening Mechanical, nobody signed in** | The browser goes to the Portal's sign-in. Mechanical's own sign-in form is not shown. |
| **After signing in on the Portal** | His dashboard shows his modules site by site. A click opens Mechanical on that site, already signed in, with no password typed in Mechanical. A person with one module on one site goes straight in. |
| **How Mechanical knows him** | The Portal sends a **ticket** after `#sso=` in the link. The ticket is signed by the Portal (ES256), is valid for 60 seconds and can be used **once**. Mechanical checks the signature with the Portal's public key (`/api/jwks`) and removes the ticket from the address at once. |
| **The Portal decides who is on the site** | A person **new to Mechanical** is written into that site's Users at his first entry. He is **not Admin** and has **no page open**; the site's Admin gives his pages, as for any new user. A person switched **off** in Mechanical but given the site in the Portal is switched **on**. **Admin** is set as the Portal says. Which **pages** a person sees stays Mechanical's own (Users & Access). Every change is written in the Activity Log ("Signed in through the Portal"). |
| **"Modules" (top bar)** | Lists his other modules on this site and Mechanical on his other sites, plus "All my modules (Portal)". One click opens it through the Portal, with no new sign-in. While an entry is still being sent, he is asked to wait. It replaces the site switch of update-90 in this mode. |
| **Password button** | Opens the Portal's "Change password". There is **one password for every module**. |
| **Logout** | Signs him out of the Portal **and** every module, and ends on the Portal's sign-in. |
| **A sign-in that ended** | Mechanical asks the Portal again **by itself**. While the Portal still knows him, he is back at once without typing. A sign-in through the Portal lasts **12 hours at most**, so access taken away in the Portal ends in Mechanical within the day. |
| **The reserve** | `https://<mechanical>/?local=1` shows Mechanical's own sign-in, for this tab only. It is used if the Portal is ever down, and by Mechanical's own Super Admin. |
| **Going round in circles** | It cannot happen: at most 3 automatic trips to the Portal in 2 minutes, then a plain message with "Open the Portal". |
| **Help** | Error help in EN / MR / HI for the new messages. |

## The Portal (repository `rcl-portal`, its own pull request)
* `?signout=1` signs the Portal out (used by Mechanical's Logout).
* `?pw=1` opens "Change password" (used by Mechanical's password button).
* Fixed: the public-key answer (`/api/jwks`) could go round in a circle forever if the key it remembered had been taken
  out of its database. It now makes a new key. A test checks this.

## Evidence (local test rig – never the live databases)
| Test | Result |
|---|---|
| `test/unit.test.js` | 61 / 61. New: the setting (https only), tickets refused before any lookup, the 12-hour session, help in 3 languages, one Modules button. |
| `test/portal91api.js` (new) | 40 / 40. The real way (Portal sign-in → `/api/go` → ticket → session). The same ticket twice: refused. A changed ticket, another key, ran out, another module, another Portal, too long, an unknown site, no number, no email: all refused. A server not linked: refuses. A new person is created with no pages. Admin on and off follows the Portal. A switched-off person is switched on. A left-over one-time password does not block him. T2 gets its own session. 12 hours old: ended. The reserve sign-in still works. Users are put back at the end. |
| `test/browser/portal91.js` (new) | 18 / 18. Computer and phone: Mechanical → Portal → dashboard → Mechanical signed in, ticket gone from the address, Modules → T2, a session that ended comes back by itself, password → Portal, Logout → Portal signed out too, `?local=1`, a server without the setting as before, no script error. |
| `test/site90api.js` / `test/site89.js` / `browser/site90.js` / `browser/cred.js` | 75 / 38 / 24 / 8 – update-89/90 unchanged (run on the server without `PORTAL_URL`). |
| Portal: unit / api / browser | 6 / 61 / 20 (the browser test 4 times in a row). |

## Not verified
* Not run on the real Vercel and Supabase. The first real check is after `PORTAL_URL` is set (steps below).
* The Portal's ticket goes from one `*.vercel.app` address to another. That works in Chrome on the rig. It was **not
  tested** on an iPhone (Safari) or on the installed app (PWA).
* Access **taken away** in the Portal ends in Mechanical at the next sign-in: within 12 hours, not at once.
* `?signout=1` on the Portal can be opened by any link. At worst it signs a person out (no data).
* Mechanical's own Super Admin screen (update-90) still exists behind `?local=1`. Users are now given in the Portal; that
  screen can be taken away once the Portal has proved itself.

## How to switch it on (after both pull requests are merged)
1. Portal → Super Admin → **Modules**: Mechanical's link must be the address people open (e.g.
   `https://oneclicksolution-erp.vercel.app`).
2. Vercel → Mechanical's project → Settings → Environment Variables → `PORTAL_URL` = the Portal's address
   (`https://rcl-portal-flame.vercel.app`, no `/` at the end) → Save → Redeploy.

## Going back
Delete `PORTAL_URL` in Vercel and redeploy. Everything works as today, and the page forgets the Portal by itself.
Or Vercel → Instant Rollback to update-90.
