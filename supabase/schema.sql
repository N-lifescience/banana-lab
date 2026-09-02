-- 수업 · 보고서 제출 스키마
--
-- Supabase 대시보드 → SQL Editor 에 **이 파일을 통째로 붙여 넣고 실행**한다.
-- 여러 번 실행해도 같은 결과가 되도록 썼다 (create if not exists / drop policy if exists).
--
-- ── 설계 원칙 넷 ──────────────────────────────────────────────────────
--   1. 이미지를 저장하지 않는다. 렌더러가 결정론적이라 시드와 파라미터만 있으면 다시 그린다.
--   2. 로그인을 만들지 않는다. 교사는 **수업 코드**와 **관리 토큰**만으로 자기 반을 연다.
--   3. 학생은 **쓰기만** 할 수 있다. 남의 보고서를 읽지 못한다 — 거기엔 이름이 들어 있다.
--   4. 기한이 지나면 사라진다. 학교 데이터를 무기한 쌓아 두지 않는다.
--
-- ── 유일한 방어선은 RLS 다 ────────────────────────────────────────────
-- 프런트엔드가 anon 키 하나로 접근한다. anon 키는 공개돼도 되는 값이지만, **RLS 를 켜지 않으면
-- 그 키 하나로 표 전체가 열린다.** 아래 정책과 컬럼 권한을 지우지 말 것.
--
-- docs/07-board-and-deploy.md 참조.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- 수업

create table if not exists classes (
  id            uuid primary key default gen_random_uuid(),
  -- 학생이 손으로 칠 수 있어야 한다. 여섯 자리 숫자.
  code          text not null unique check (code ~ '^[0-9]{6}$'),
  -- 교사가 자기 반을 여는 열쇠. 링크에 담겨 교사 브라우저에만 남는다.
  -- 아래 GRANT 로 anon 에게 **이 컬럼의 조회 권한을 주지 않는다** — 정책은 내부적으로
  -- 표 소유자 권한으로 돌기 때문에, 정책은 이 값을 볼 수 있고 클라이언트는 볼 수 없다.
  teacher_token text not null,
  -- 어느 실험인가. 실험이 늘어도 표는 하나다 (src/manifest.js 의 id).
  exp           text not null default 'banana',
  title         text not null default '',
  -- 봉인용 자물쇠(선생님 브라우저가 만든 ECDH 공개키, base64url). 열쇠는 여기 없다 —
  -- 관리 링크의 # 뒤에만 있어 서버에 오지 않는다. 학생은 이 값으로 보고서를 잠가 보낸다.
  -- 비어 있으면(봉인 이전에 연 수업) 학생이 그대로 보낸다. packages/lab-kit/net/seal.js
  pubkey        text not null default '',
  created_at    timestamptz not null default now(),
  -- 기본 30일. 학기 말까지 두고 싶으면 교사가 늘려 잡는다. 최대 180일.
  expires_at    timestamptz not null default now() + interval '30 days'
    check (expires_at > now() - interval '1 day'
       and expires_at < now() + interval '180 days')
);

create index if not exists classes_code_idx    on classes (code);
create index if not exists classes_token_idx   on classes (teacher_token);
create index if not exists classes_expires_idx on classes (expires_at);

-- ---------------------------------------------------------------- 제출된 보고서

create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes (id) on delete cascade,
  exp          text not null default 'banana',

  -- 누가 낸 것인가. 교사가 채점하려면 이만큼은 있어야 한다.
  -- **이 두 컬럼이 이 프로젝트에서 유일한 개인정보다.** 더 늘리지 말 것.
  -- ★ 봉인된 제출(아래 sealed)에서는 이 둘과 payload 가 **비어 있다** — 봉투 안에 들어 있다.
  student_no   text check (student_no   is null or length(student_no)   between 1 and 12),
  student_name text check (student_name is null or length(student_name) between 1 and 20),

  mode  text not null check (mode in ('solo', 'group')),
  level int  not null check (level between 1 and 3),

  -- 보고서를 그대로 다시 그리는 데 필요한 값 한 벌.
  -- 시야 이미지가 아니라 **시드와 파라미터**다 — 교사 화면이 같은 그림을 다시 그린다.
  payload  jsonb,

  -- 봉인된 보고서 { v, epk, iv, ct }. 선생님 공개키로 잠근 것이라 **표를 여는 사람도 못 읽는다.**
  -- 안에 student_no · student_name · payload 가 들어 있다. packages/lab-kit/net/seal.js
  sealed   jsonb,

  -- 봉인됐거나(sealed) 그대로거나(세 칸 다 있음) — 둘 중 하나여야 한다. 반쯤 빈 행은 없다.
  constraint reports_sealed_or_plain check (
    sealed is not null
    or (student_no is not null and student_name is not null and payload is not null)
  ),

  created_at timestamptz not null default now()
);

-- 봉인 이전에 만든 표에 칸을 더한다 (여러 번 실행해도 안전).
alter table classes add column if not exists pubkey text not null default '';
alter table reports add column if not exists sealed jsonb;
alter table reports alter column student_no   drop not null;
alter table reports alter column student_name drop not null;
alter table reports alter column payload      drop not null;

-- 이미지 컬럼을 추가하지 말 것. 시드로 재생성한다.
comment on table reports is
  '시야 이미지를 저장하지 않는다. payload 안의 seed + 파라미터로 클라이언트가 재생성한다.';

create index if not exists reports_class_idx on reports (class_id, created_at desc);

-- ---------------------------------------------------------------- 헤더에서 열쇠를 읽는다
--
-- PostgREST 는 요청 헤더를 정책 안에서 읽을 수 있게 해 준다.
-- 클라이언트가 매 요청에 실어 보낸다:  x-class-code: 482013  /  x-teacher-token: <긴 난수>

create or replace function current_class_code() returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-class-code', '')
$$;

create or replace function current_teacher_token() returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-teacher-token', '')
$$;

-- ---------------------------------------------------------------- RLS

alter table classes enable row level security;
alter table reports enable row level security;

-- 수업 조회: 자기 코드를 대거나, 자기 관리 토큰을 대야 한다.
-- 코드를 모르면 목록조차 볼 수 없다 — 표를 훑어 가는 길이 없다.
drop policy if exists classes_select on classes;
create policy classes_select on classes for select
  using (
    expires_at > now()
    and (code = current_class_code() or teacher_token = current_teacher_token())
  );

-- 수업 개설: 누구나 할 수 있다. 로그인을 만들지 않기로 했기 때문이다.
-- 대신 만들어지는 것은 빈 수업뿐이고, 기한 상한은 위 CHECK 가 강제한다.
drop policy if exists classes_insert on classes;
create policy classes_insert on classes for insert with check (true);

-- 수업 닫기: 관리 토큰을 아는 사람만. 지우면 그 반 보고서가 함께 사라진다(cascade).
drop policy if exists classes_delete on classes;
create policy classes_delete on classes for delete
  using (teacher_token = current_teacher_token());

-- 제출: 살아 있는 수업의 코드를 아는 사람만 넣을 수 있다.
drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert with check (
  exists (
    select 1 from classes c
    where c.id = reports.class_id
      and c.code = current_class_code()
      and c.expires_at > now()
  )
);

-- 조회·삭제: **담당 교사만.** 학생은 자기가 낸 것조차 다시 읽지 못한다 —
-- 읽을 수 있게 하면 같은 수업 코드를 가진 다른 학생도 읽게 되고, 거기엔 이름이 들어 있다.
drop policy if exists reports_teacher_select on reports;
create policy reports_teacher_select on reports for select using (
  exists (
    select 1 from classes c
    where c.id = reports.class_id
      and c.teacher_token = current_teacher_token()
      and c.expires_at > now()
  )
);

drop policy if exists reports_teacher_delete on reports;
create policy reports_teacher_delete on reports for delete using (
  exists (
    select 1 from classes c
    where c.id = reports.class_id
      and c.teacher_token = current_teacher_token()
  )
);

-- ---------------------------------------------------------------- 컬럼 권한
--
-- RLS 는 **어느 행**을 볼지 정하고, GRANT 는 **어느 칸**을 볼지 정한다. 둘 다 필요하다.
-- 이것이 없으면 학생 브라우저가 `select=teacher_token` 을 물어 남의 반 관리 토큰을 가져간다.

revoke all on table classes from anon;
grant select (id, code, exp, title, created_at, expires_at, pubkey) on classes to anon;
grant insert (code, teacher_token, exp, title, expires_at, pubkey)  on classes to anon;
grant delete on classes to anon;

revoke all on table reports from anon;
grant select (id, class_id, exp, student_no, student_name, mode, level, payload, sealed, created_at)
  on reports to anon;
grant insert (class_id, exp, student_no, student_name, mode, level, payload, sealed) on reports to anon;
grant delete on reports to anon;

-- ---------------------------------------------------------------- 만료 정리
--
-- 기한이 지난 수업은 스스로 사라져야 한다. 정책이 가려 주기는 하지만 **데이터는 남는다** —
-- 학생 이름을 무기한 들고 있지 않겠다는 약속은 실제로 지워야 지켜진다.
-- 대시보드에서 pg_cron 확장을 켠 뒤 한 번 실행한다:
--
--   select cron.schedule('purge-expired-classes', '0 3 * * *',
--     $$ delete from classes where expires_at < now() $$);
--
-- classes 를 지우면 reports 는 on delete cascade 로 함께 사라진다.
