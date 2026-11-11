# update-229 – Google Search Console's ownership file (no SQL) (12-11-2026)

**Asked (12-11-2026):** the owner sent Google's file `google7a73bb83a881ba3b.html` – Search Console said "Ownership verification
failed … Your verification file was not found in the required location." – and: "coming soon rahude" (HR & Attendance and Payroll
stay as "Coming soon" on the public page – nothing changes there).

## What is added
`app/google7a73bb83a881ba3b.html` – word for word as Google gave it – copied by `build.js` to the root:
`https://erp.oneclicksolution.dpdns.org/google7a73bb83a881ba3b.html`. It is not a secret (Google asks for it to be public) and
says nothing of the ERP. It must stay there: Google reads it again from time to time.

## Evidence
* `timeout 300 node --test test/unit.test.js` – all pass (new: `update-229`); `node build.js` puts the file in `public/`.

## Not verified
* Google's own check – the owner presses "Verify" again after the merge.

## Going back
Vercel → Instant Rollback to update-228 (Search Console then loses the ownership after a while).
