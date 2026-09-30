# RCL Fleet ERP – Vercel वर (Apps Script च्या बाहेर)

App तेच आहे: तेच screens, तेच नियम, तेच prints. बदल फक्त एवढा की app आता Apps Script ऐवजी Vercel वरून चालते.

| भाग | कुठे |
|---|---|
| Data | Supabase (तोच database, काहीही हलवलेले नाही) |
| Backup | Google Sheet – Apps Script मधले backup triggers तसेच चालू राहतात |
| App (page + नियम) | Vercel |

`app/` मधल्या files (`App.html`, `Index.html`, `Code.gs`, `SupabaseSync.gs`, `SupabaseData.gs`, `ReadMe.gs`) त्याच आहेत ज्या Apps Script मध्ये आहेत. Vercel वर त्या **न बदलता** चालतात; `server/` मधला छोटा code त्यांना Apps Script च्या सोयी (settings, session, lock) Supabase मधून देतो.

## Folder

- `app/` – app च्या files. पुढचे सगळे बदल इथेच होतील.
- `server/`, `api/`, `build.js`, `vercel.json` – Vercel वर चालवण्यासाठी. यात बदल करायची गरज नसते.
- `sql/` – सगळ्या SQL files. नवीन: `supabase_step1s_boq_items.sql`, `supabase_step2_web.sql`.
- `apps-script/VercelBridge.gs` – Apps Script project मध्ये एक नवीन file म्हणून paste करायची.

---

## A. तयारी (एकदाच)

**1. Supabase**
- SQL Editor मध्ये `sql/supabase_step1s_boq_items.sql` चालवा (आधी चालवली नसेल तर).
- मग `sql/supabase_step2_web.sql` चालवा. ही फक्त नवीन गोष्टी वाढवते; app चा data आणि चालू Apps Script app याला धक्का लागत नाही.
- Project Settings मध्ये तुमच्या project चा **Region** पाहून ठेवा.

**2. GitHub**
- github.com वर account काढा.

**3. VS Code**
- Git (git-scm.com) आणि VS Code install करा.
- हा folder (`rcl-fleet-erp`) VS Code मध्ये उघडा: File → Open Folder.
- डावीकडे Source Control → **Publish to GitHub** → **private repository** निवडा.

**4. Vercel**
- vercel.com वर GitHub account ने sign up करा. कंपनीच्या कामासाठी **Pro plan** लागतो (Hobby plan फक्त वैयक्तिक वापरासाठी आहे).
- Add New → Project → `rcl-fleet-erp` repository import करा. Framework Preset: **Other**.
- **Environment Variables** मध्ये दोन नोंदी करा (Apps Script च्या Script Properties मध्ये जे आहे तेच):
  - `SUPABASE_URL` = `https://mydhljgncdszrglqppsv.supabase.co`
  - `SUPABASE_SECRET_KEY` = `sb_secret_…` (ही key कधीही code मध्ये किंवा git मध्ये टाकू नका)
- Deploy.

**5. Region**
- `vercel.json` मध्ये `"regions": ["bom1"]` (Mumbai) आहे. Supabase चा region Mumbai (ap-south-1) असेल तर तसेच ठेवा. Singapore (ap-southeast-1) असेल तर `bom1` च्या जागी `sin1` लिहा, commit करा. Region जवळ नसेल तर app हळू वाटेल.

Deploy झाल्यावर Vercel एक link देईल. ती उघडली की sign-in page दिसेल. **ही link अजून कोणालाही देऊ नका.**

---

## B. तपासणी (फक्त तुम्ही)

1. Apps Script editor मध्ये `apps-script/VercelBridge.gs` नवीन file म्हणून paste करा, आणि `app/Code.gs`, `app/SupabaseSync.gs`, `app/ReadMe.gs`, `app/App.html` paste करून Save करा (New version deploy करा – item-wise BOQ चा pack यातच आहे).
2. Editor मध्ये `exportSettingsToWeb` function एकदा Run करा. हे bill settings, company details, format names, शेवटचे numbers Supabase मध्ये copy करते. पुन्हा चालवले तरी चालते.
3. Vercel च्या link वर तुमच्या त्याच email / password ने sign in करा.
4. तपासा: Dashboard, Log Book list, एक Log Book print, एक जुने Saved Bill, Reports – जुन्या app शी जुळते का, आणि वेग कसा वाटतो.

तपासणीच्या काळात:
- Entries जुन्या app मधूनच चालू ठेवा. नवीन app मध्ये फक्त पाहा.
- दोन्ही app मधून एकाच वेळी save करू नका (दोघांचा "एका वेळी एकच save" चा lock वेगळा आहे).
- जुन्या app मध्ये झालेला बदल नवीन app मध्ये page पुन्हा उघडल्यावर दिसतो (आपोआप refresh होत नाही).

---

## C. बदलण्याचा दिवस

संध्याकाळी, कोणी entry करत नसताना:

1. Apps Script editor मध्ये `exportSettingsToWeb` पुन्हा Run करा (ताजे settings आणि numbers जातात).
2. Apps Script → Project Settings → Script Properties मध्ये नवीन property: `APP_MOVED_TO` = Vercel ची link.
   एका मिनिटात जुने app सगळ्यांसाठी बंद होते: जुनी link उघडली की नवीन link दिसते, आणि उघड्या असलेल्या जुन्या page वरून काहीही save होत नाही.
3. सगळ्यांना नवीन link द्या. Email आणि password तेच; एकदा पुन्हा sign in करावे लागेल.

Apps Script project **delete करू नका** – Google Sheet backup तिथूनच चालतो.

## D. परत जायचे असेल तर

Script Property `APP_MOVED_TO` delete करा. एका मिनिटात जुने app पुन्हा चालू होते. Data एकच (Supabase) असल्याने नवीन app मधल्या entries तिथे दिसतात. नवीन app मध्ये बदललेले settings (उदा. company details) जुन्या app मध्ये पुन्हा भरावे लागतील.

---

## E. पुढचे बदल कसे जातील

1. बदललेली file `app/` मध्ये (किंवा नवीन SQL `sql/` मध्ये) ठेवा.
2. नवीन SQL असेल तर आधी Supabase मध्ये चालवा.
3. VS Code → Source Control → message लिहा → Commit → Sync Changes.
4. Vercel आपोआप deploy करते. उघड्या app ला नवीन version आपोआप मिळते (आत्तासारखेच).

चूक झाली तर Vercel → Deployments मध्ये आधीचे deployment निवडून परत आणता येते.

---

## F. "Backup now" बटण

Backup आपोआप चालूच राहतो (Apps Script मधून) आणि app मध्ये शेवटच्या backup ची वेळ दिसते. वरचे "Backup" बटण दाबून लगेच backup करण्यासाठी:

1. Apps Script project मध्ये `VercelBridge` file चा मजकूर `apps-script/VercelBridge.gs` ने बदला → Save → Deploy → Manage deployments → ✏️ → **New version** → Deploy. (Who has access: **Anyone** असले पाहिजे.)
2. Vercel → Settings → Environment Variables: `GAS_BACKUP_URL` = Apps Script web app ची `/exec` link (जुन्या app ची link) → Save → Deployments → Redeploy.

वेगळी गुप्त key लागत नाही: दोन्ही बाजूंकडे आधीच असलेल्या Supabase secret key चा ठसा वापरला जातो (key स्वतः पाठवली जात नाही).
हा भाग Google शी जोडून तपासलेला नाही.

---

## माहितीसाठी

- App दर सेकंदाला server ला "काही बदलले का" विचारते (आत्तासारखेच). Vercel वर हे calls मोजले जातात; users वाढले की Vercel च्या Usage page वर लक्ष ठेवा.
- एका उत्तरात साधारण 4.5 MB पेक्षा जास्त data Vercel पाठवत नाही. खूप मोठ्या कालावधीची यादी एकदम मागितली तर "pick a shorter period" असा संदेश येईल.
- App अजूनही प्रत्येक वेळी मुख्य tables पूर्ण वाचते (server च्या memory मध्ये copy ठेवून). Data खूप वाढल्यावर ते सुधारणे हे वेगळे काम आहे.
- स्वतःच्या computer वर चालवून पाहायचे असेल: `.env.local` file मध्ये वरचे दोन variables लिहा, `node dev.js`, मग `http://localhost:3000`.
