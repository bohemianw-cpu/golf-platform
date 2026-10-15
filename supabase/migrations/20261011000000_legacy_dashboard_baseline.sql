-- 마이그레이션 도입 전 Supabase 대시보드에서 직접 만든 객체의 기준 스키마.
-- 2026-10-16 운영 DB 카탈로그 추출(scripts/db/export-legacy-schema.sql) 결과에서
-- 이후 마이그레이션이 추가한 컬럼·제약·인덱스·정책·트리거를 뺀 상태다.
-- 새 환경을 처음부터 만들 때 필요하며, 이미 객체가 있는 운영 DB에서는 아무것도 바꾸지 않는다.

create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default timezone('utc', now()),
  email text not null,
  nickname text not null,
  terms_agreed_at timestamptz not null,
  privacy_agreed_at timestamptz not null,
  role text not null default 'user',
  handicap integer default 20,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rounds (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  golf_club text default '골프장 미지정',
  played_at date not null default current_date,
  total_score integer default 0,
  total_putts integer default 0,
  fairway_rate text,
  gir_rate text,
  status text default '진행중',
  club_name text default '골프장 미지정',
  course_name text default '',
  round_date date not null default current_date,
  holes_count integer not null default 18,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.round_holes (
  id uuid not null default gen_random_uuid() primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer not null default 4,
  score integer not null default 4,
  putts integer not null default 2,
  fairway_hit boolean,
  gir boolean,
  memo text default '',
  created_at timestamptz not null default timezone('utc', now()),
  shots jsonb not null default '[]'::jsonb,
  total_distance integer,
  unique (round_id, hole_number)
);

-- 초기 샷 테이블. 정규화 컬럼은 20261011171754 이후 마이그레이션이 추가하고,
-- lie·remaining_dist·shot_dist는 sync_round_shot_legacy_columns 트리거가 채운다.
create table if not exists public.round_shots (
  id uuid not null default gen_random_uuid() primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  hole_number integer not null,
  hole_par integer not null default 4,
  shot_number integer not null,
  club text not null,
  lie text not null,
  remaining_dist numeric(7,1) not null,
  shot_dist numeric(7,1) default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_clubs (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- 운영 DB의 pro_id는 public.pros(id)를 참조하지만 pros 정의는 추출 범위 밖이라 외래키는 생략한다.
create table if not exists public.lesson_inquiries (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamptz not null default timezone('utc', now()),
  pro_id uuid,
  user_name text not null,
  user_phone text not null,
  trouble_type text not null,
  swing_video_url text,
  message text not null,
  status text default '대기중'
);

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.round_holes enable row level security;
alter table public.round_shots enable row level security;
alter table public.user_clubs enable row level security;
alter table public.lesson_inquiries enable row level security;

-- 운영 DB에 이미 있는 정책은 건드리지 않는다. 삭제 정책과 프로필·샷 정책은 이후 마이그레이션이 만든다.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rounds' and policyname = '본인 라운드만 조회') then
    create policy "본인 라운드만 조회" on public.rounds for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rounds' and policyname = '본인 라운드만 생성') then
    create policy "본인 라운드만 생성" on public.rounds for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rounds' and policyname = '본인 라운드만 수정') then
    create policy "본인 라운드만 수정" on public.rounds for update using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'round_holes' and policyname = '본인 홀 기록만 조회') then
    create policy "본인 홀 기록만 조회" on public.round_holes for select
      using (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'round_holes' and policyname = '본인 홀 기록만 생성') then
    create policy "본인 홀 기록만 생성" on public.round_holes for insert
      with check (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'round_holes' and policyname = '본인 홀 기록만 수정') then
    create policy "본인 홀 기록만 수정" on public.round_holes for update
      using (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'round_holes' and policyname = '본인 홀 기록만 삭제') then
    create policy "본인 홀 기록만 삭제" on public.round_holes for delete
      using (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_clubs' and policyname = '본인 클럽만 조회') then
    create policy "본인 클럽만 조회" on public.user_clubs for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_clubs' and policyname = '본인 클럽만 생성') then
    create policy "본인 클럽만 생성" on public.user_clubs for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_clubs' and policyname = '본인 클럽만 수정') then
    create policy "본인 클럽만 수정" on public.user_clubs for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_clubs' and policyname = '본인 클럽만 삭제') then
    create policy "본인 클럽만 삭제" on public.user_clubs for delete using (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = 'public' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  insert into public.profiles (id, nickname, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', '골퍼_' || substr(new.id::text, 1, 6)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;
