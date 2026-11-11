# update-228 – a public page (/about) for search engines; every other page answers "noindex" (no SQL) (12-11-2026)

**Asked (12-11-2026):** "I want our One Click Solution ERP to be discoverable on Google Search" – target address
`https://erp.oneclicksolution.dpdns.org`; brand One Click Solution, product Rachana ERP, "Construction ERP & Enterprise Management
Platform"; a professional public landing page with a clear Sign In; all authenticated modules stay private; canonical, metadata,
sitemap, structured data; "Do not publish company contact details, phone numbers or email addresses without asking me first."

## Before
The address's first page is the app itself; the Portal's sign-in page says `noindex`; there was no robots.txt and no sitemap.
Nothing a search engine could list – and nothing told it NOT to list the app's pages.

## What is added (static files and vercel.json – the app, the server and the database are not touched)
1. **`/about`** (`app/about.html`) – the public page: what Rachana ERP is, its modules, "Sign In" (→ `/portal/`), "Get the mobile
   app" (→ `/app`). Title, description, canonical (the new address), Open Graph, and structured data: `Organization` (One Click
   Solution) and `WebSite`. No script. **Nothing of the inside:** no person, site, figure, e-mail, phone or address.
   *HR & Attendance* and *Payroll* are on it as **"Coming soon"** – they are not in the ERP today (the owner decides: keep so, or take out).
2. **`/robots.txt`** – the servers' addresses (`/api/`, `/portal/api/` …) are not fetched; the sitemap's address.
3. **`/sitemap.xml`** – the public pages only: `/about`, `/app`.
4. **Every other page answers `X-Robots-Tag: noindex, nofollow`** (vercel.json): the app's page, `/ho/`, `/scan`, the Portal, the
   Store, Engineering, Purchase, every `/api/…` – never listed, even when another site links to them.
5. **One address in the listings:** the canonical and the sitemap say the new address, so the same page under the old
   `…vercel.app` address is not a second entry.

## To be merged only AFTER the new address works
The canonical, the sitemap and the structured data name `https://erp.oneclicksolution.dpdns.org`. Until that address is added in
Vercel and answers with HTTPS, this update should wait (a canonical to an address that does not answer helps nobody).

## Evidence
* `timeout 300 node --test test/unit.test.js` – 180 of 180 (new: `update-228` – the page's metadata and structured data, nothing
  of the inside on it, the sitemap's two addresses, the noindex rule tried on 12 private and 5 public addresses).
* `node build.js` puts `about.html`, `robots.txt`, `sitemap.xml` in `public/`; the page opened in a browser (desktop and phone width):
  drawn, three "Sign In" links, no page error.

## Not verified
* On Vercel: the header rule and `/about` on the real address (a Preview of this branch shows it); Google itself – whether and
  when it lists the page cannot be promised.
* Google Search Console: the owner verifies the address and submits the sitemap (steps given to him).

## Going back
Vercel → Instant Rollback to update-227. Nothing is kept anywhere.
