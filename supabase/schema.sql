-- 临床跟台 Case Support 基础库表
-- 执行前请确认已启用 pgcrypto: create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('Admin', 'Engineer')),
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region text,
  level text,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  category text,
  sn_prefix text,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_cases (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  hospital_id uuid references public.hospitals(id),
  doctor_name text not null,
  engineer_id uuid references public.users(id),
  status text not null default '进行中',
  surgery_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_details (
  case_id uuid primary key references public.clinical_cases(id) on delete cascade,
  device_id uuid references public.devices(id),
  parameters jsonb not null default '{}'::jsonb,
  outcome text,
  complications text
);

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.clinical_cases(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  batch_no text,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.clinical_cases(id) on delete cascade,
  file_url text not null,
  type text not null check (type in ('Image', 'Video')),
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_cases_date on public.clinical_cases(date desc);
create index if not exists idx_clinical_cases_hospital on public.clinical_cases(hospital_id);
create index if not exists idx_consumables_case_id on public.consumables(case_id);
create index if not exists idx_media_case_id on public.media(case_id);

-- 建议打开 RLS 并按业务角色配置策略
alter table public.clinical_cases enable row level security;
alter table public.case_details enable row level security;
alter table public.consumables enable row level security;
alter table public.media enable row level security;
