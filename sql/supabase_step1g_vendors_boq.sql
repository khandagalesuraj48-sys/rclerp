-- =====================================================================
-- RCL Fleet ERP – Vendors (party master) and BOQ (rate contracts)
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs / SupabaseData.gs).
-- =====================================================================
create table if not exists public.vendors (
  id text primary key,
  vendor_name text,
  ownership text,
  gst_registered text,
  gst_number text,
  gst_percent numeric,
  pan_number text,
  tds_percent numeric,
  bank_name text,
  branch text,
  account_number text,
  ifsc_code text,
  address text,
  phone text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.boq (
  id text primary key,
  boq_no text,
  vendor_name text,
  valid_from date,
  valid_to date,
  amendment_of text,
  amendment_no numeric,
  lines text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists vendors_touch on public.vendors;
create trigger vendors_touch before update on public.vendors for each row execute function public.touch_updated_at();
drop trigger if exists vendors_deleted on public.vendors;
create trigger vendors_deleted after delete on public.vendors for each row execute function public.note_delete();
alter table public.vendors enable row level security;
create index if not exists vendors_updated_at on public.vendors (updated_at);

drop trigger if exists boq_touch on public.boq;
create trigger boq_touch before update on public.boq for each row execute function public.touch_updated_at();
drop trigger if exists boq_deleted on public.boq;
create trigger boq_deleted after delete on public.boq for each row execute function public.note_delete();
alter table public.boq enable row level security;
create index if not exists boq_updated_at on public.boq (updated_at);
create index if not exists boq_vendor on public.boq (vendor_name);

grant select, insert, update, delete on public.vendors, public.boq to service_role;
