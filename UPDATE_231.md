# update-231 – the public page names the owner's own domain `oneclicksolution.online` (no SQL) (12-11-2026)

**Asked (12-11-2026):** he bought `oneclicksolution.online` (BigRock), added it to the Vercel project (main: without `www`;
`www` → 308 → it) and: "oneclicksolution.online he sagli kadhe adhi set kruya"; `erp.oneclicksolution.dpdns.org` is to be
removed later ("dpdns.org ha purn remove kraycha aahe").

## What is changed
* `app/about.html` (canonical, og:url, og:image, the JSON-LD ids and urls), `app/sitemap.xml` (`/about`, `/app`),
  `app/robots.txt` (Sitemap): `https://oneclicksolution.online/…` instead of `https://erp.oneclicksolution.dpdns.org/…`.
* Nothing else: no page of the ERP, no server code, no rule of `vercel.json`. Google's ownership file stays as it is.

## The owner's part (Vercel, not in this repository)
`PUBLIC_URL` of the Portal, `PORTAL_URL` of Mechanical / Store / Engineering / Purchase, `PUBLIC_URL` of Store / Engineering /
Purchase → the new address, then Redeploy; Portal → Modules: the links. Search Console: a new property for the new domain.
`oneclicksolution-erp.vercel.app` stays (the phone app uses it).

## Evidence
* `timeout 600 node --test test/unit.test.js` – 183 pass, 0 fail (new: `update-231`; `update-228`'s addresses updated).

## Not verified
* Google's reading of the new address; the redirect of the old address (none is made here).

## Going back
Vercel → Instant Rollback to update-230.
