# Beta (चाचणी) – एकदाच करायचे set-up

**हे काय आहे (02-11-2026 ला मागितले):** नवीन काहीही आधी **फक्त निवडलेल्या लोकांना (testers)** मिळते – web आणि app दोन्ही.
बाकी सर्वांकडे आत्ता चालू असलेले (stable) तसेच राहते. सगळे ठीक वाटले की Portal मध्ये **एक बटण** – "Give to everybody" –
दाबले की तोच version सर्वांना जातो: web live होते आणि सगळ्या phones ला app update येतो. प्रत्येक वेळी code बदल नाही,
Claude ला सांगायची गरज नाही.

```
Claude चे काम → PR → तुम्ही merge (branch "beta")  →  testers ला लगेच नवीन web
Portal → Versions → "New beta version"            →  testers ला नवीन app (10–15 मिनिटे)
testers तपासतात
Portal → Versions → "Give to everybody (Stable)"   →  सर्वांना web + app
```

**महत्त्वाचे:**
* Beta copy **live data** वरच चालते (वेगळा database नाही). Testers जे save करतात ते खरे आहे.
* म्हणून database चा नवीन SQL step असेल तर तो **फक्त जोडणारा** (नवीन column / table) असतो आणि beta मध्ये जाण्याआधीच live मध्ये
  चालवायचा. Stable ला त्याने काही फरक पडत नाही.
* Portal (sign-in) एकच आहे – सर्वांसाठी. Portal चे बदल TEST copy (staging) वर तपासले जातात.
* Beta copy कोणताही Google Sheet backup, Drive copy किंवा रात्रीचे काम करत नाही – ते live copy करते (दोनदा होऊ नये म्हणून).

Beta चे पत्ते (Vercel team `pk12356843`, branch `beta`):

| | पत्ता |
|---|---|
| Mechanical (मुख्य) | `https://rclerp-git-beta-pk12356843.vercel.app` |
| Store | `https://rclerp-git-beta-pk12356843.vercel.app/store` |
| Purchase | `https://rclerp-git-beta-pk12356843.vercel.app/purchase` |
| Engineering | `https://rclerp-git-beta-pk12356843.vercel.app/engineering` |

---

## 1. Pull requests merge करा (main मध्ये – ही पायाभरणी आहे, live ला काही बदलत नाही)
सहा repositories मध्ये `beta-setup` चा PR: `rcl-portal`, `rclerp`, `rcl-store`, `rcl-purchase`, `rcl-engineering`, `rcl-mobile`.
Live वर (Production) काहीही बदलत नाही: beta फक्त `beta` branch आणि `RCL_CHANNEL = beta` दोन्ही असले तरच चालू होतो.

## 2. Portal चा SQL step 7 (एकदा, फक्त Portal च्या Supabase मध्ये)
GitHub → `rcl-portal` → `sql/portal_step7_beta.sql` → Raw → copy → Supabase → **Portal चा project** → SQL Editor → paste → Run.
हा फक्त दोन रिकामे columns जोडतो (`users.tester` = false, `modules.beta_url` = रिकामे). शेवटची ओळ: `Portal step 7 done · users.tester 1 · modules.beta_url 1`.

## 3. Vercel – `beta` branch साठी settings (चार projects)
प्रत्येक project → **Settings → Environment Variables → Add New** →
**Environments: फक्त Preview** → **Branch: `beta`** (Preview निवडल्यावर "Select a branch" येते) → नाव आणि value → Save.

| Project | नाव | `beta` branch ची value |
|---|---|---|
| `rclerp` | `SUPABASE_URL` | Production मधलीच (live पहिल्या site ची) |
| `rclerp` | `SUPABASE_SECRET_KEY` | Production मधलीच |
| `rclerp` | `PORTAL_URL` | `https://oneclicksolution-erp.vercel.app/portal` |
| `rclerp` | `RCL_CHANNEL` | `beta` |
| `rcl-store` | `SUPABASE_URL` | Production मधलीच |
| `rcl-store` | `SUPABASE_SECRET_KEY` | Production मधलीच |
| `rcl-store` | `PORTAL_URL` | `https://oneclicksolution-erp.vercel.app/portal` |
| `rcl-store` | `PUBLIC_URL` | `https://rclerp-git-beta-pk12356843.vercel.app/store` |
| `rcl-store` | `RCL_CHANNEL` | `beta` |
| `rcl-purchase` | `SUPABASE_URL` | Production मधलीच (Purchase चा database) |
| `rcl-purchase` | `SUPABASE_SECRET_KEY` | Production मधलीच |
| `rcl-purchase` | `PORTAL_URL` | `https://oneclicksolution-erp.vercel.app/portal` |
| `rcl-purchase` | `PUBLIC_URL` | `https://rclerp-git-beta-pk12356843.vercel.app/purchase` |
| `rcl-purchase` | `RCL_CHANNEL` | `beta` |
| `rcl-engineering` | `SUPABASE_URL` | Production मधलीच (Engineering चा database) |
| `rcl-engineering` | `SUPABASE_SECRET_KEY` | Production मधलीच |
| `rcl-engineering` | `PORTAL_URL` | `https://oneclicksolution-erp.vercel.app/portal` |
| `rcl-engineering` | `PUBLIC_URL` | `https://rclerp-git-beta-pk12356843.vercel.app/engineering` |
| `rcl-engineering` | `RCL_CHANNEL` | `beta` |

**इतर सगळी नावे** (`RCL_SITES_KEY`, `PORTAL_SECRET`, `SITE_…_KEY`, `FCM_SERVICE_ACCOUNT_JSON`, `ANTHROPIC_API_KEY` …): ज्यांना फक्त
**Production** ची टिक आहे, त्यांची value beta लाही लागते → **Add New** → Preview → Branch `beta` → तीच value. ज्यांना Preview
ची टिक आधीच आहे त्यांना हात लावू नका.

Keys फक्त Vercel मध्येच – chat मध्ये किंवा file मध्ये कधीच नाही.

## 4. Vercel – `beta` branch बनू द्या, Vercel login काढा
* **`rclerp`**: Settings → Git → **Ignored Build Step** → आत्ताची ओळ बदलून ही टाका → Save:
  ```
  if [ "$VERCEL_ENV" = "production" ] || [ "$VERCEL_GIT_COMMIT_REF" = "staging" ] || [ "$VERCEL_GIT_COMMIT_REF" = "beta" ]; then exit 1; else exit 0; fi
  ```
* **`rcl-purchase`** आणि **`rcl-engineering`**: Settings → **Deployment Protection** → Vercel Authentication → **Disabled** → Save
  (`rclerp` आणि `rcl-store` मध्ये staging साठी आधीच केले आहे). नाहीतर Mechanical च्या beta पत्त्यातून ती पाने उघडणार नाहीत.

## 5. GitHub – Portal ची एक key ("Give to everybody" आणि "New beta version" साठी)
1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. Name `rcl-portal-versions`; Resource owner `khandagalesuraj48-sys`; Expiration: 1 year.
3. Repository access → **Only select repositories** → `rclerp`, `rcl-portal`, `rcl-store`, `rcl-purchase`, `rcl-engineering`, `rcl-mobile`.
4. Permissions → **Contents: Read and write**, **Actions: Read and write** → Generate.
5. ती key लगेच Vercel → **`rcl-portal`** → Environment Variables → `GITHUB_RELEASE_TOKEN` (**Production**) मध्ये paste → Save →
   Deployments → Redeploy. कुठेही लिहू नका, chat मध्ये नाही.

## 6. `beta` branches (Claude बनवते, तुमच्या "हो" नंतर)
पायरी 1–5 झाल्यावर सहा repositories मध्ये `main` पासून `beta` branch. Vercel beta copies आपोआप बनवते (2–3 मिनिटे).

## 7. Portal मध्ये
1. **Modules** → प्रत्येकाच्या **Beta link** मध्ये वरच्या तक्त्यातला पत्ता → Save (Mechanical, Store, Purchase, Engineering).
2. **Users & Access** → testers पैकी एक → **User Details** → **Tester** ला टिक. (यादीत त्याच्या नावापुढे "Beta" दिसेल.)
3. **Versions** → **New beta version** → 10–15 मिनिटांनी Refresh → पहिला beta version दिसेल.

## 8. तपासणी
1. Tester म्हणून sign in → Mechanical उघडा → वर **जांभळी पट्टी**: "BETA – the new version for testers · the data is LIVE".
   पट्टी नारिंगी ("TEST copy") असेल तर `RCL_CHANNEL` किंवा branch चे settings चुकले आहेत (पायरी 3) – थांबा, Claude ला सांगा.
   आतमध्ये खरी site आणि खरी machinery दिसली पाहिजे. "TEST Site (staging)" दिसले तर `SUPABASE_URL` / key (branch `beta`) चुकले
   आहेत – थांबा, Claude ला सांगा.
2. Tester नसलेला user → कोणतीही पट्टी नाही (stable), आधीसारखे.
3. Tester च्या phone वर app → Me → Check for update → beta version येतो.

---

## पुढे: प्रत्येक नवीन काम
1. Claude चा PR आता **`beta`** मध्ये येतो (main मध्ये नाही). तुम्ही merge करता → testers ला web लगेच.
2. नवीन SQL step असेल तर: फक्त जोडणारा; **आधी live मध्ये** (प्रत्येक site च्या Supabase मध्ये) – मग merge.
3. Portal → Versions → **New beta version** → testers ला app (बदलले असेल तरच; नाहीतर फक्त web चा version).
4. Testers तपासतात. ठीक → Versions → त्या version पुढे **Give to everybody (Stable)** → version चे नाव टाइप करा → सर्वांना.
   (आधी तपासते: प्रत्येक repository चा `main` फक्त पुढे सरकतो; `main` मध्ये beta मध्ये नसलेले काही असेल तर काहीही बदलत
   नाही आणि कारण सांगते.)
5. Activity मध्ये सगळे लिहिले जाते: कोणी, कोणता version, काय live झाले.

**मागे जाणे:**
* एखाद्याला tester मधून काढा → त्याच्या पुढच्या उघडण्याला stable.
* Module चा Beta link रिकामा करा → सर्वांना stable.
* Stable वर गेलेला web: Vercel → project → Deployments → आधीचा → **Instant Rollback** (आधीसारखेच).
* `RCL_CHANNEL` काढले किंवा `beta` branch काढली → beta copies live data वापरणे बंद करतात (TEST copy सारखे नाकारतात).
