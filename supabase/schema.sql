-- 모둠 결과 보드 스키마
--
-- 설계 원칙 두 가지:
--   1. 이미지를 저장하지 않는다. 렌더러가 결정론적이므로 시드와 파라미터만 있으면 재생성된다.
--   2. 개인정보를 받지 않는다. 로그인 없이 수업 코드 + 모둠 번호만 쓴다.
--
-- docs/07-board-and-deploy.md 참조.

-- ---------------------------------------------------------------- 수업

create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[0-9]{6}$'),  -- 교사가 발급하는 6자리
  title       text not null default '',
  teacher_pin text not null,                                      -- 카드 삭제 권한 확인용
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

create index if not exists classes_code_idx on classes (code);
create index if not exists classes_expires_idx on classes (expires_at);

-- ---------------------------------------------------------------- 제출

create table if not exists submissions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes (id) on delete cascade,
  group_no   int  not null check (group_no between 1 and 20),
  slide      text not null check (slide in ('A', 'B', 'C')),

  -- 시야를 재생성하는 데 필요한 값 전부. src/sim/state.js 의 fieldParams() 와 같다.
  reagent    text     check (reagent in ('IKI', 'SUDAN3') or reagent is null),
  drops      int      not null default 0,
  objective  int      not null check (objective in (4, 10, 40)),
  focus_err  real     not null default 0,
  brightness real     not null default 1,
  bubbles    int      not null default 0,
  too_thick  boolean  not null default false,
  contaminated boolean not null default false,
  seed       bigint   not null,

  quality    int      not null check (quality between 0 and 100),
  note       text     not null default '',     -- 학생 서술. 이름을 적지 않도록 UI에서 안내한다
  is_seed_card boolean not null default false, -- 빈 보드용 예시 카드

  created_at timestamptz not null default now()
);

-- 이미지 컬럼을 추가하지 말 것. 시드로 재생성한다.
comment on table submissions is
  '시야 이미지를 저장하지 않는다. seed + 파라미터로 클라이언트가 재생성한다.';

create index if not exists submissions_class_idx on submissions (class_id, created_at desc);

-- ---------------------------------------------------------------- RLS
--
-- anon key 하나로 프런트엔드가 접근하므로 RLS 가 유일한 방어선이다.
-- 반드시 켠 채로 배포할 것.

alter table classes     enable row level security;
alter table submissions enable row level security;

-- 현재 세션이 알고 있는 수업 코드. 클라이언트가 매 요청에 실어 보낸다.
--   supabase.rpc 대신 PostgREST 헤더로 넘긴다:
--   headers: { 'x-class-code': '482013' }
create or replace function current_class_code() returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-class-code', '')
$$;

-- 수업: 자기 코드로만 조회된다. 코드를 모르면 목록조차 볼 수 없다.
drop policy if exists classes_select on classes;
create policy classes_select on classes for select
  using (code = current_class_code() and expires_at > now());

-- 제출: 같은 수업의 것만 조회·삽입할 수 있다.
drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions for select
  using (exists (
    select 1 from classes c
    where c.id = submissions.class_id
      and c.code = current_class_code()
      and c.expires_at > now()
  ));

drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions for insert
  with check (exists (
    select 1 from classes c
    where c.id = submissions.class_id
      and c.code = current_class_code()
      and c.expires_at > now()
  ));

-- 삭제는 교사 화면에서만. 서비스 롤로 처리하고 anon 에게는 열지 않는다.

-- ---------------------------------------------------------------- 만료 정리
--
-- Supabase 대시보드에서 pg_cron 확장을 켠 뒤 실행한다.
--
--   select cron.schedule('purge-expired-classes', '0 3 * * *',
--     $$ delete from classes where expires_at < now() $$);
--
-- classes 를 지우면 submissions 는 on delete cascade 로 함께 사라진다.

-- ---------------------------------------------------------------- Realtime
--
-- 대시보드 Database → Replication 에서 submissions 를 publication 에 추가한다.
-- 클라이언트는 class_id 로 필터해 구독한다.
