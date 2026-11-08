# update-94 – the pages of Mechanical are given in the Portal (13-10-2026)

Asked by the owner on 13-10-2026: what Mechanical's Admin sees in Users & Access – which user gets which page, Edit / View /
No access – the Super Admin must see and set in the Portal.

Until now that was set only inside Mechanical, and since update-90 only by the Super Admin's old screen (`?local=1`). A new
person the Portal brought into Mechanical had no page, and in practice nobody could give him one.

## What changes
| Where | What |
|---|---|
| **Portal → Super Admin → Users & Access** | Next to each user's Mechanical role there is a **Pages** link. It opens every page of Mechanical with **Edit / View / No access** for that site; **Save pages** writes them into Mechanical. An Admin has Edit everywhere, so no page list is shown for him. |
| **A person who has never opened Mechanical** | His pages can be set now. He is written into that site's Users with these pages, ready for his first sign-in. |
| **Mechanical → Users & Access (Admin)** | As before, it only **shows** the list (users are given by the Super Admin). |
| **Activity Log** | Mechanical writes "Pages set by the Super Admin in the Portal" with the changes. The Portal's Activity tab writes "Pages". |

## How it is safe
* The Portal's **server** asks Mechanical's server with a ticket it **signs itself** (ES256) for "mechanical-admin". The
  ticket is valid for 60 seconds and can be used once. Mechanical checks the signature with the Portal's public key.
* What to set travels **inside** the signed ticket, so nothing can be changed on the way.
* A person's sign-in ticket cannot be used for this, and this ticket opens no session.
* Only Edit / View / No access are taken. Active and Admin are not changed this way; the Portal sets those at the person's sign-in.
* No password leaves Mechanical.

## Evidence (local rig – never live)
* `test/portal94api.js` (new): 17 / 17.
* Portal API 78 / 78. New checks: the Super Admin reads S1's pages and sets one; a site he does not have is refused;
  nobody but the Super Admin can do it.
* Portal browser 27 / 27. New: "Pages" → every page → set Diesel Issue to Edit → saved in Mechanical. This also found and
  fixed a layout fault where the next box covered the link.
* Unchanged: unit 61, portal91api 40, browser portal91 20, site90api 75.

## Not verified
Not run on live.

## Merge order
Mechanical first, then the Portal. If the Portal goes first, "Pages" just says Mechanical does not know the request yet.

## Going back
Vercel → Instant Rollback (Mechanical to update-93). The Portal's "Pages" then answers with an error; nothing else changes.
