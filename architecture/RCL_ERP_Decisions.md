# RCL ERP – decisions taken (owner: Sujit Mule)

| Date | Decision |
|---|---|
| 13-10-2026 | **Build the Portal first.** It is the central login for everyone and shows each person a dashboard of the modules they may open. Only the Super Admin manages the Portal. The users who sign in to Mechanical today move to the Portal with the passwords they have now. Mechanical's own login stays until the Portal is proven. |
| 13-10-2026 | **Every new module (Engineering, Store, Billing, …) has everything Mechanical has now:** several sites, per-site access, Super Admin, help. A new site must need no coding – only 2–4 inputs (name, company, modules, Google Sheet). |
| 13-10-2026 | **Databases:** <br>• **one database per module**; inside it, every site's entries are kept separately (each entry carries its site);<br>• a new site gets the same module database automatically;<br>• the Portal has its own database;<br>• Reporting has its own database, which only reads from the modules;<br>• **Mechanical stays as it is: one database per site** (VTR; 18B next). The Portal's "New site" will also make Mechanical's database. |
| 13-10-2026 | **Modules are connected for reporting** through common IDs given by the Portal: site/project, machinery, BOQ item, chainage. Example: Engineering reports show machinery expense from Mechanical. Expense per BOQ item needs Log Book entries to carry a BOQ item or chainage – to be decided when Engineering is designed. |
| 13-10-2026 | **One module = one GitHub repo (private) + one Vercel project + its database.** Each is made when that module starts, not before. Folders sit side by side in `WEBSITE AND APP\` (not inside `rcl-fleet-erp`). |
| 13-10-2026 | **Stay on Supabase (Postgres); no move to MongoDB.** The app relies on transactions, all-or-nothing saves and relational accounting data. |
| 13-10-2026 | **No ZIP files any more.** Work happens through VS Code (Claude Code) or GitHub branches and pull requests. `CLAUDE.md` holds the rules (commit `9057b86`). |

Full review: `architecture/RCL_ERP_Architecture_Review_Phase0.md`.