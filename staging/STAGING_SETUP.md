# Staging (TEST) database – एकदाच करायचे set-up

**हे काय आहे:** live सारखीच एक **TEST copy** (Mechanical + Portal + Store). तिचा database वेगळा आहे (`rcl-staging`).
त्यात फक्त काही बनावट TEST नोंदी आहेत. नवीन update आधी इथे तपासायचा, मग live वर घ्यायचा.
Live ला यातून काहीही होत नाही.

**सुरक्षा (code मध्ये, update-138):**
* Vercel ची Preview copy फक्त तोच database वापरते ज्यात `THIS_IS_A_TEST_DATABASE = yes` ही खूण आहे. ही खूण फक्त
  staging मध्ये असते. Live database दिला तरी Preview काहीही वाचत नाही आणि लिहीत नाही; ती "This is a Preview …" असा
  error दाखवते.
* Preview मधून Google Sheet backup कधीच होत नाही.
* प्रत्येक पानावर वर नारिंगी पट्टी दिसते: **"TEST copy (Preview) – the staging database · nothing here is live"**.

Staging copies चे पत्ते (Vercel team `pk12356843`, branch `staging`):

| | पत्ता |
|---|---|
| Mechanical (मुख्य पत्ता) | `https://rclerp-git-staging-pk12356843.vercel.app` |
| Portal (त्याच पत्त्याखाली, live सारखा) | `https://rclerp-git-staging-pk12356843.vercel.app/portal/` |
| Store (त्याच पत्त्याखाली, live सारखा) | `https://rclerp-git-staging-pk12356843.vercel.app/store/` |

---

## 1. Supabase – नवीन project
Supabase → **New project**:
* नाव `rcl-staging`;
* region **Mumbai**;
* database password: नवीन ठेवा, कुठेही लिहू नका.

तयार झाल्यावर दोन गोष्टी लागतील:
* **Project URL** (Settings → Data API);
* **secret key** (Settings → API Keys → Secret keys).

हे फक्त Vercel मध्ये paste करायचे. Chat मध्ये किंवा कोणत्याही file मध्ये नाही.

## 2. एक SQL (फक्त `rcl-staging` मध्ये)
1. GitHub → `rclerp` → `staging/rcl_staging_all.sql` → **Raw** → सगळे copy करा.
2. Supabase → **rcl-staging** project → SQL Editor → New query → paste करा.
3. सर्वात वरच्या 3 ओळींमध्ये `' '` च्या आत तुमचे टाका:
   * तुमचा email;
   * तुमचे नाव;
   * एक तात्पुरता password (8 किंवा जास्त अक्षरे). पहिल्या sign-in ला Portal स्वतःचा नवीन password मागेल.
4. **Run** दाबा. Supabase "destructive operation" असा इशारा दाखवू शकते: हा नवीन रिकामा project आहे, म्हणून **Run** करा.
5. शेवटची ओळ अशी दिसली पाहिजे:
   `TEST database ready · test mark: yes · machinery 3 · vendors 1 · items 3 · sites 1 · …`

**ही SQL चुकीच्या ठिकाणी चालणार नाही:**
* 3 values टाकल्या नसतील, किंवा
* database मध्ये आधीच ERP चे tables असतील आणि TEST खूण नसेल (म्हणजे live),

तर ती "STOPPED – nothing was run" म्हणून थांबते आणि काहीही बदलत नाही. Staging मध्ये ती पुन्हा चालवली तरी चालते (जे आहे ते तसेच राहते).

TEST नोंदी (सगळ्या बनावट):
* कंपनी "TEST Co", site S1 "TEST Site (staging)";
* vendor "Test Vendor A";
* machinery TEST-JCB-01, TEST-TIPPER-01, TEST-EXC-01;
* Store items ITM-0001…0003;
* Portal मध्ये Mechanical आणि Store modules.

## 3. Vercel – फक्त **Preview** साठी settings
तिन्ही projects मध्ये: **Settings → Environment Variables**.

खालील प्रत्येक नाव असे बदला:
1. ते आधीच "Production, Preview…" साठी असेल तर: **Edit** → **Preview** ची टिक काढा → Save. Production जसे आहे तसेच राहते.
2. **Add New** → तेच नाव → नवीन value → फक्त **Preview** ला टिक → Save.

| Project | नाव | Preview ची value |
|---|---|---|
| `rclerp` | `SUPABASE_URL` | rcl-staging चा Project URL |
| `rclerp` | `SUPABASE_SECRET_KEY` | rcl-staging ची secret key |
| `rclerp` | `PORTAL_URL` | `https://rclerp-git-staging-pk12356843.vercel.app/portal` |
| `rcl-portal` | `SUPABASE_URL` | rcl-staging चा Project URL |
| `rcl-portal` | `SUPABASE_SECRET_KEY` | rcl-staging ची secret key |
| `rcl-portal` | `PUBLIC_URL` | `https://rclerp-git-staging-pk12356843.vercel.app/portal` |
| `rcl-store` | `SUPABASE_URL` | rcl-staging चा Project URL |
| `rcl-store` | `SUPABASE_SECRET_KEY` | rcl-staging ची secret key |
| `rcl-store` | `PORTAL_URL` | `https://rclerp-git-staging-pk12356843.vercel.app/portal` |
| `rcl-store` | `PUBLIC_URL` | `https://rclerp-git-staging-pk12356843.vercel.app/store` |

बाकीचे settings जसे आहेत तसेच राहू द्या (`PORTAL_SECRET`, `SITE_…_KEY`, `RCL_SITES_KEY`, Google backup, `MECH_URL` / `MECH_KEY` …).
Preview कोणताही live database आपोआप नाकारते आणि backup करत नाही.

## 4. Vercel – `staging` branch ची Preview बनू द्या
`rclerp` आणि `rcl-portal` मध्ये सध्या Preview बनत नाहीत (ते "Ignored" दिसतात). दोन्हीमध्ये:
1. **Settings → Git** (किंवा Build and Deployment) → **Ignored Build Step** → **Custom** निवडा.
2. ही एक ओळ टाका → Save:
   ```
   if [ "$VERCEL_ENV" = "production" ] || [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 1; else exit 0; fi
   ```
   (main → live आणि staging → TEST copy बनतात; बाकी branches पूर्वीप्रमाणे बनत नाहीत.)

`rcl-store` मध्ये Preview आधीच बनतात, तिथे बदलण्याची गरज नाही.

## 5. Vercel – Preview वरचे Vercel login काढा
तिन्ही projects मध्ये: **Settings → Deployment Protection** → **Vercel Authentication** → **Disabled** → Save.

असे का: तिन्ही staging copies एकमेकांना sign-in तपासायला बोलवतात (Portal ची key, Mechanical ची users list). Vercel login मध्ये असेल तर ही बोलवणी थांबतात.

Live पत्ता यात कधीच नव्हता, म्हणून live ला काहीही बदलत नाही. Staging copy मध्येही sign-in लागतो, आणि तिथे फक्त TEST नोंदी आहेत.

## 6. `staging` branch (Claude बनवते, तुमच्या "हो" नंतर)
तिन्ही repositories मध्ये `main` पासून `staging` branch बनते. Vercel तिन्ही TEST copies आपोआप बनवते (2–3 मिनिटे).

## 7. तपासणी
1. `https://rclerp-git-staging-pk12356843.vercel.app/portal/` उघडा. वर **नारिंगी TEST पट्टी** दिसली पाहिजे.
   **पट्टी दिसत नसेल तर थांबा:** Vercel → project → Settings → Environment Variables →
   "Automatically expose System Environment Variables" ला टिक असली पाहिजे.
2. पायरी 2 मधला email आणि तात्पुरता password टाका → स्वतःचा नवीन password ठेवा.
3. Super Admin console मध्ये → **My modules** → Mechanical आणि Store दोन्ही उघडून पाहा (TEST नोंदी दिसतील).
4. Test users हवे असतील तर Portal → Users & Access मधून बनवा (live सारखेच).

---

## पुढे: प्रत्येक update आधी staging वर
1. नवीन update चा branch आधी `staging` मध्ये जातो (Claude करते). TEST copy बनते. तुम्ही तिथे तपासता.
2. Update मध्ये नवीन SQL step असेल तर: आधी **rcl-staging** मध्ये, नंतर live मध्ये. दोन्ही तुम्हीच चालवता.
3. सगळे बरोबर असेल तर PR merge → live.

**मागे जाणे:**
* Preview च्या settings काढल्या, किंवा Ignored Build Step पूर्वीसारखा केला, तर staging बंद होते.
* `rcl-staging` project हा फक्त TEST आहे. Live database ला काहीही होत नाही.

**SQL file पुन्हा बनवणे** (नवीन SQL step आला की; Claude करते):
```
node staging/make_staging_sql.js
```
हे `rcl-store` आणि `rcl-portal` च्या SQL files बाजूच्या folders मधून वाचते.
