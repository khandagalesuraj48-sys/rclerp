-- =====================================================================
-- RCL Fleet ERP – SEVERAL SITES, ONE APP (update-90, stage 2 of "new site")
-- Run ONCE, and ONLY in the database of the FIRST site (VTR) – the one whose link is in Vercel (SUPABASE_URL).
-- Supabase → SQL Editor → New query → paste → Run. It can be run again safely.
--
-- Only ADDS 4 new tables. Not one existing table, row or column is changed:
--   rcl_super_admin  the Super Admin (system only: sites, users and access, companies – no entries, no reports)
--   rcl_companies    the companies a site belongs to (Rachana, Sketchline …): name, address, GSTIN, PAN, logo
--   rcl_sites        the sites: this one is the first ("S1", its database is the one in Vercel – nothing about it is stored);
--                    other sites (stage 3) keep their database's link and key LOCKED (encrypted with a key only Vercel has)
--   rcl_user_sites   which user has which site, and his default site
-- Every user of this site today becomes a user of site S1 (copied from app_users – app_users itself is not touched).
-- The tables are for the server only (secret key): row level security on, no policy, nothing for anon / authenticated.
-- =====================================================================
create table if not exists public.rcl_super_admin (
  email text primary key, name text, password_hash text not null, recovery_hash text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- there is ONE Super Admin: a second row is refused by the database itself
create unique index if not exists rcl_super_admin_only_one on public.rcl_super_admin ((true));
create table if not exists public.rcl_companies (
  id text primary key, name text not null, address text, gstin text, pan text, logo text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.rcl_sites (
  code text primary key, name text, company_id text references public.rcl_companies (id), home boolean not null default false,
  status text not null default 'ready', sheet text, db_url text, db_key_enc text, db_conn_enc text, sort int not null default 0,
  created_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists rcl_sites_one_home on public.rcl_sites (home) where home;
create table if not exists public.rcl_user_sites (
  email text not null, site text not null references public.rcl_sites (code), is_admin boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (email, site)
);
create index if not exists rcl_user_sites_email on public.rcl_user_sites (email);

drop trigger if exists rcl_super_admin_touch on public.rcl_super_admin;
create trigger rcl_super_admin_touch before update on public.rcl_super_admin for each row execute function public.touch_updated_at();
drop trigger if exists rcl_companies_touch on public.rcl_companies;
create trigger rcl_companies_touch before update on public.rcl_companies for each row execute function public.touch_updated_at();
drop trigger if exists rcl_sites_touch on public.rcl_sites;
create trigger rcl_sites_touch before update on public.rcl_sites for each row execute function public.touch_updated_at();
drop trigger if exists rcl_user_sites_touch on public.rcl_user_sites;
create trigger rcl_user_sites_touch before update on public.rcl_user_sites for each row execute function public.touch_updated_at();

alter table public.rcl_super_admin enable row level security;
alter table public.rcl_companies enable row level security;
alter table public.rcl_sites enable row level security;
alter table public.rcl_user_sites enable row level security;
revoke all on public.rcl_super_admin, public.rcl_companies, public.rcl_sites, public.rcl_user_sites from public, anon, authenticated;
grant select, insert, update, delete on public.rcl_super_admin, public.rcl_companies, public.rcl_sites, public.rcl_user_sites to service_role;

-- this site = site S1 (its name: the site name of "Company & site", if it was set – a setting that cannot be read leaves it empty)
do $$
declare nm text;
begin
  begin
    select nullif(trim(value::jsonb ->> 'site'), '') into nm from web.props where key = 'ORG_SETTINGS';
  exception when others then nm := null;
  end;
  if not exists (select 1 from public.rcl_sites where home) then
    insert into public.rcl_sites (code, name, home, status, sort) values ('S1', nm, true, 'ready', 1);
  end if;
end $$;
-- every user of this site today is a user of S1 (with his Admin mark); a user already listed is left as he is
insert into public.rcl_user_sites (email, site, is_admin)
select lower(trim(u.email)), (select code from public.rcl_sites where home), upper(coalesce(u.admin, '')) = 'YES'
  from public.app_users u
 where coalesce(trim(u.email), '') <> '' and upper(coalesce(u.active, 'YES')) <> 'NO'
on conflict (email, site) do nothing;

-- the database's web layer learns the new tables at once
notify pgrst, 'reload schema';

-- what is there now (a look – it changes nothing)
select 'sites: ' || (select count(*) from public.rcl_sites) || ' · people on sites: ' || (select count(*) from public.rcl_user_sites)
       || ' · super admin: ' || (select count(*) from public.rcl_super_admin) as done;
