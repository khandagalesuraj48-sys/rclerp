# update-112 – One language for all of a person's sites (15-10-2026)

**Asked:** "app madhe mala language change ha option hawa aahe all site user sathi hindi marathi english … jya language madhe
selection asel purn app tyach language madhe asel, error suggestions pn tyach language madhe". The phone app's part is version
3.1.6 (its own repository). This is Mechanical's part.

## What changes
* The language of the app (and of the help) is the **person's**: when he chooses it at one site – on the web (Settings →
  Language of the app) or in the phone app – it is written at **every other site where he is a user** too.
* "English" is now kept as a choice of its own (`en`); not chosen yet stays as before (English on the web).
* A site that cannot be reached at that moment keeps its own until the next change. Nothing else of the settings moves between
  sites.
* No SQL step.

## Evidence (local rig, test data only)
* Unit 77 / 77 – "update-112": only a change of the language asks the other sites, once; the other site writes it only for its
  own user; English = "en"; the page cannot call the other-site action.
* Rig, two sites (`test/lang112api.js`) 5 / 5: Hindi chosen at S1 → written at T2; English chosen at T2 → back at S1; a theme
  change stays at its site.
* Browser lang110.js 17 / 17 (the English button now keeps "en").

## Not verified
* Not run on the live sites.

## Going back
Vercel → Instant Rollback to update-111. A setting already written stays (the older code reads "en" as not chosen – English).
