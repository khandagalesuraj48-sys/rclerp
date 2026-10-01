# RCL Fleet ERP

App तेच आहे: तेच screens, तेच नियम, तेच prints. Apps Script कुठेही लागत नाही.

| भाग | कुठे |
|---|---|
| Code | GitHub (`khandagalesuraj48-sys/rclerp`), VS Code मधून push |
| App (page + नियम) | Vercel – push केल्यावर आपोआप deploy |
| Data | Supabase |
| Backup (copy) | Google Sheet – Vercel मधूनच लिहिली जाते |

`app/` मधल्या `.gs` files हा app चा server code आहे (नियम, हिशोब). नाव `.gs` असले तरी त्या आता Vercel वरच चालतात, Google वर नाही.

## Folder

- `app/` – app च्या files. पुढचे सगळे बदल इथेच होतील.
- `server/`, `api/`, `build.js`, `vercel.json` – Vercel वर चालवण्यासाठी. यात बदल करायची गरज नसते.
- `sql/` – सगळ्या SQL files (Supabase → SQL Editor मध्ये चालवायच्या).

## Vercel मधले Environment Variables

| नाव | काय |
|---|---|
| `SUPABASE_URL` | `https://mydhljgncdszrglqppsv.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google ने दिलेल्या key file चा पूर्ण मजकूर (खाली पहा) |
| `BACKUP_SHEET_ID` | Backup Google Sheet ची link |

Keys कधीही code मध्ये किंवा git मध्ये टाकू नका.

---

## Google Sheet backup (एकदाच करायची जोडणी)

Backup लिहिण्यासाठी Google चे एक "service account" (फक्त या कामासाठीचे robot खाते) लागते.

**1. Google Cloud project**
- `console.cloud.google.com` उघडा (ज्या Google account मध्ये backup Sheet ठेवायची त्याने sign in).
- वर project निवडण्याच्या जागी **New Project** → नाव `rcl-erp` → Create. तो project निवडा.

**2. Sheets API चालू करा**
- डावीकडे **APIs & Services → Library** → `Google Sheets API` शोधा → **Enable**.

**3. Service account बनवा**
- **APIs & Services → Credentials → Create credentials → Service account**.
- नाव `rcl-backup` → Create and continue → Done.

**4. Key file**
- यादीतल्या `rcl-backup@…iam.gserviceaccount.com` वर click करा → **Keys** → **Add key → Create new key → JSON** → Create.
- एक `.json` file download होईल. ती कोणालाही पाठवू नका.
- त्या खात्याचा email (`rcl-backup@….iam.gserviceaccount.com`) copy करून ठेवा.

**5. Backup Sheet (आधीचीच Sheet पुढे चालू राहते)**
- आधीची backup Sheet उघडा → **Share** → service account चा email paste करा → **Editor** → Send.
- जुन्या backup ने प्रत्येक tab ला कुलूप (protection) लावलेले आहे. ते एकदा काढा: **Data → Protect sheets and ranges** → उजवीकडे यादी येईल → प्रत्येक नोंदीवर click → कचरापेटी → Remove.
- जुना Apps Script backup आधी थांबवा (खाली "जुने Apps Script app बंद करणे" मधली पायरी 2), नाहीतर तो पुन्हा कुलूप लावेल आणि service account ला Sheet मधून काढून टाकेल.
- Sheet ची link copy करा.

**6. Vercel**
- Settings → Environment Variables:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` = `.json` file Notepad मध्ये उघडून पूर्ण मजकूर (`{` पासून `}` पर्यंत) paste करा.
  - `BACKUP_SHEET_ID` = Sheet ची link.
- Deployments → सर्वात वरच्या deployment वर **Redeploy**.

**7. तपासा**
- App मध्ये वरचे **Backup** बटण दाबा. "Full backup done" असे आले पाहिजे, आणि Sheet मध्ये प्रत्येक table चा tab दिसला पाहिजे.
- संदेशात "protected" आले तर पायरी 5 मधले कुलूप काढायचे राहिले आहे; 403 आले तर पायरी 2 किंवा 5 मधले Share राहिले आहे; 404 आले तर Sheet ची link चुकली आहे.

### Backup कधी होतो

- App कोणाकडेही उघडे असताना: बदल झाल्यावर साधारण 5 मिनिटांत, फक्त बदललेले tables.
- रोज रात्री 2 वाजता: सगळे tables पुन्हा (Vercel cron).
- **Backup** बटण दाबल्यावर: लगेच.
- Users चे passwords Sheet मध्ये कधीही जात नाहीत.
- Sheet फक्त वाचण्यासाठीची copy आहे; त्यात केलेला बदल पुढच्या backup मध्ये पुसला जातो.
- Tabs ची नावे, मथळे आणि मांडणी जुन्या backup सारखीच आहे.
- जुन्या backup ने Sheet "link असलेला कोणीही पाहू शकतो" अशी ठेवली आहे. ती फक्त तुमच्यापुरती ठेवायची असेल तर Share → General access → Restricted करा.

---

## जुने Apps Script app बंद करणे (शेवटचे एकदाच)

सगळ्यांना नवीन link (`https://rclerp.vercel.app`) दिल्यावर, दोन्ही app एकाच वेळी वापरले जाऊ नयेत म्हणून:

1. Apps Script → **Deploy → Manage deployments** → जुने deployment **Archive** करा. जुनी link बंद होते.
2. Apps Script → डावीकडे **Triggers** (घड्याळ) → सगळे triggers delete करा. जुना backup थांबतो.

यानंतर Apps Script project उघडायची गरज नाही. Email आणि password तेच राहतात; सगळ्यांना नवीन link वर एकदा sign in करावे लागेल.

---

## पुढचे बदल कसे जातील

1. बदललेली file `app/` मध्ये (किंवा नवीन SQL `sql/` मध्ये) ठेवा.
2. नवीन SQL असेल तर आधी Supabase मध्ये चालवा.
3. VS Code terminal:
   ```
   git add -A
   git commit -m "काय बदलले"
   git push
   ```
4. Vercel आपोआप deploy करते; उघड्या app ला नवीन version आपोआप मिळते.

चूक झाली तर Vercel → Deployments मध्ये आधीचे deployment निवडून परत आणता येते.

## माहितीसाठी

- App दर सेकंदाला server ला "काही बदलले का" विचारते. Vercel वर हे calls मोजले जातात; users वाढले की Usage page वर लक्ष ठेवा.
- एका उत्तरात साधारण 4.5 MB पेक्षा जास्त data Vercel पाठवत नाही; खूप मोठ्या कालावधीची यादी मागितली तर "pick a shorter period" असा संदेश येतो.
- Sidebar चे रंग `app/App.html` मध्ये "LOOK 2026-10" या भागाच्या सुरुवातीला एका ठिकाणी आहेत (`--sb-…`).
