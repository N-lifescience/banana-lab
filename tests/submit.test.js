/**
 * 제출 기능의 **선**을 지킨다.
 *
 * 여기서 잡으려는 것은 기능이 도는가가 아니라, 도는 김에 넘지 말아야 할 선을 넘지 않는가다.
 * 이 선들은 한 번 넘으면 조용히 넘어간다 — 화면은 똑같이 잘 돌기 때문이다.
 *
 *   · RLS 를 끄면 anon 키 하나로 표 전체가 열린다. 그래도 앱은 멀쩡히 돈다
 *   · 교사 토큰을 조회 가능한 칸에 넣으면 학생 브라우저가 남의 반 열쇠를 가져간다
 *   · 학생에게 조회 권한을 주면 같은 반 학생끼리 서로의 이름을 읽는다
 *   · 서비스 롤 키를 프런트에 넣으면 RLS 가 통째로 무의미해진다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enabled, SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/net/supabase.js';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/net/supabase.js', import.meta.url), 'utf8');

test('설정이 없으면 제출 기능은 꺼진 것으로 본다', () => {
  // 설정하지 않은 학교에서도 앱이 그대로 돌아야 한다. 켜지지 않은 것이 기본값이다.
  assert.equal(SUPABASE_URL, '');
  assert.equal(SUPABASE_ANON_KEY, '');
  assert.equal(enabled(), false);
});

test('두 표 모두 RLS 가 켜져 있다', () => {
  for (const table of ['classes', 'reports']) {
    // 줄 시작에 붙인다. 주석 처리(`-- alter table …`)된 줄에도 걸리면 검사가 아니다.
    assert.match(schema, new RegExp(`^alter table ${table} enable row level security`, 'm'),
      `${table} 에 RLS 가 없습니다 — anon 키 하나로 표 전체가 열립니다`);
  }
});

test('교사 토큰은 학생이 조회할 수 있는 칸에 들어 있지 않다', () => {
  const grant = schema.match(/grant select \(([^)]*)\) on classes to anon;/);
  assert.ok(grant, 'classes 의 조회 컬럼 권한이 명시돼 있지 않습니다');
  assert.equal(grant[1].includes('teacher_token'), false,
    '학생 브라우저가 select=teacher_token 으로 남의 반 열쇠를 가져갈 수 있습니다');
});

test('보고서 조회는 교사 토큰을 요구한다', () => {
  const policy = schema.match(/create policy reports_teacher_select on reports for select using \(([\s\S]*?)\n\);/);
  assert.ok(policy, 'reports 의 조회 정책을 찾지 못했습니다');
  assert.match(policy[1], /current_teacher_token\(\)/,
    '학생도 조회할 수 있으면 같은 반 학생끼리 서로의 이름을 읽습니다');
  assert.equal(/current_class_code\(\)/.test(policy[1]), false,
    '수업 코드만으로 조회되면 코드를 아는 학생 전부가 남의 보고서를 읽습니다');
});

test('제출은 살아 있는 수업의 코드를 요구한다', () => {
  const policy = schema.match(/create policy reports_insert on reports for insert with check \(([\s\S]*?)\n\);/);
  assert.ok(policy, 'reports 의 삽입 정책을 찾지 못했습니다');
  assert.match(policy[1], /current_class_code\(\)/);
  assert.match(policy[1], /expires_at > now\(\)/, '기한이 지난 수업에도 쌓이면 안 됩니다');
});

test('보관 기간에 상한이 있다', () => {
  // "영구 보관" 이 한 번 생기면 아무도 지우지 않는다. 스키마가 막는다.
  assert.match(schema, /expires_at < now\(\) \+ interval '180 days'/);
});

test('서비스 롤 키가 프런트엔드에 없다', () => {
  assert.equal(/service_role/.test(client), false);
  // eyJ… 로 시작하는 JWT 를 소스에 박아 두지 않았는가
  assert.equal(/eyJ[A-Za-z0-9_-]{20,}/.test(client), false, '키를 소스에 박아 두지 마세요');
});

test('저장하는 것은 그림이 아니라 시드와 파라미터다', () => {
  assert.match(schema, /이미지 컬럼을 추가하지 말 것/);
  assert.equal(/\bbytea\b/.test(schema), false, '이미지를 담을 칸을 만들지 마세요');
});

test('개인정보 칸은 둘뿐이다', () => {
  // 늘리는 것은 쉽고 되돌리는 것은 어렵다. 늘어나면 여기서 걸린다.
  const cols = [...schema.matchAll(/^\s{2}(\w+)\s+(text|int|uuid|jsonb|timestamptz)/gm)]
    .map((m) => m[1]);
  const personal = cols.filter((c) => /student|name|email|phone|birth|photo/.test(c));
  assert.deepEqual(personal.sort(), ['student_name', 'student_no'],
    '개인정보 칸을 늘리려면 개인정보처리방침과 학교 절차를 먼저 고치세요');
});

test('개인정보처리방침이 제출 기능을 실제로 설명한다', () => {
  // 화면이 하는 일과 방침이 어긋나면, 그건 화면이 거짓말을 하는 것이다.
  const policy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  for (const must of ['선생님께 제출', '학번', '자동으로 삭제', '법정대리인', 'Supabase']) {
    assert.ok(policy.includes(must), `방침에 "${must}" 설명이 없습니다`);
  }
});
