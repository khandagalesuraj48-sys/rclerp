# CLAUDE.md – RCL Fleet ERP (Mechanical module)

Read this first, then `HANDOVER.md` (the history of every update and how things are built) and the newest `UPDATE_*.md`.
`AUDIT.md` must stay unchanged.

## The owner and how to talk to him
* Owner: Sujit Mule, MD of Rachana Construction Limited (RCL). The product name is "One Click Solution – Fleet ERP".
* **Reply in Marathi (Devanagari).** Put the answer first. Keep it simple. One step at a time. Short progress messages.
* "adhi charcha kar" = discuss first, write no code. "fkt check kr" = only check, change nothing.

## Rules (all of them, every time)
1. **Deliver exactly what he asks, nothing extra.** No feature, tab, rule or prefilled data he did not ask for. He decides each step.
2. **Keep screens simple**, easy to understand at a glance.
3. **The app is live and business-critical.**
   * Never delete, reset or overwrite production data.
   * Never run destructive SQL.
   * Never deploy or push to `main` without his explicit yes.
   * Any database change (a new SQL step) must be justified and approved separately. He runs the SQL himself in Supabase.
   * Existing features, calculations (especially bills, ledgers, stock) and permissions must keep working exactly as before.
4. **Evidence, not claims.**
   * Read the actual code.
   * Measure before and after.
   * Run the tests.
   * Report plainly what was NOT run or NOT verified.
5. **Every shell, test and network command has a time limit** (`timeout …`). If a test hangs, run it alone, find the exact case and fix the hang. Never just re-run something that hung.
6. **Fix a thing everywhere it is used**, not in one place only. Example: a rule in Edit Log Book must also work on the Log Book entry page.
7. **Errors and help in English, Marathi and Hindi.**
   * Every new server error message gets a help rule in `FIX_RULES` (`app/App.html`); the unit test checks the coverage.
   * Every new action is listed in `PAGE_GUIDE` (`saves`).
8. **The repository is PUBLIC** (until it is made private): no secret, key, password or personal data in any file. Secret keys are never pasted in chat; they live only in Vercel → Environment Variables.
9. **Preview deployments use the LIVE database** today (the same Vercel variables). Do not push a branch that writes data until a staging database is set for Preview.

## How the app is built (short – details in HANDOVER.md)
| Part | Where |
|---|---|
| Page (plain JavaScript, one file) | `app/App.html`, loaded in an iframe by `app/Index.html` |
| Server code (Apps Script style), run on Vercel in a Node `vm` | `app/Code.gs`, `app/SupabaseData.gs`, `app/SupabaseSync.gs`, `app/Sites.gs`, `app/ReadMe.gs` |
| Server runtime | `server/runtime.js` (`OUTSIDE` list, `R.runIn`), `server/gas.js` (settings, cache, lock, per-site memory), `server/pool.js` |
| Several sites (one database per site), Super Admin | `server/sites.js`, `server/system.js`, `app/Sites.gs`, `sql/supabase_step7_sites.sql` (first site only) |
| Endpoints | `api/rpc.js` (all actions), `api/backup.js` (Google Sheet backup) |
| Database steps | `sql/` – numbered; each is listed word for word in `app/ReadMe.gs` (`README_SQL_`) |
| Every action and its access | `API_` in `app/Code.gs` (server-side check for every action) |

## Tests
* Unit tests (no database needed):
  ```
  timeout 300 node --test test/unit.test.js
  ```
* API and browser tests need a local copy of the database set-up: Postgres + PostgREST + the door at `:3100`, app servers on `:3000` / `:3001`. Build that copy before claiming those tests passed. Without it, say they were not run.
* Before handing over a change, check:
  * `node --check` passes on `server/*.js` and `api/*.js`;
  * the page's script blocks parse;
  * no secret is in the change.

## How a change reaches production (the owner does the last step)
1. Discuss → plan → **his approval**.
2. Make the change on a branch. Run the tests.
3. Write `UPDATE_<n>.md`: what changed, the evidence, what was not verified, how to go back. Add a line to `HANDOVER.md`.
4. He reviews, commits and pushes, or merges the pull request. Vercel deploys `main`. A new SQL step: he runs it in Supabase himself.
5. Going back: Vercel → Instant Rollback to the previous update.