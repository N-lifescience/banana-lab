/**
 * 애셋 도형을 만드는 기하 헬퍼.
 *
 * 유기적인 형태(비늘잎, 벗긴 표피 조각)는 손으로 패스 데이터를 적는 대신
 * "중심선 + 폭 프로파일"로 정의한다. 그래야 굵기나 벗긴 정도 같은 값을
 * 바꿔도 형태가 매끄럽게 따라온다.
 *
 * 기구처럼 직선적인 형태는 그냥 패스 문자열로 적는 편이 낫다. 억지로 쓰지 말 것.
 */

/** 3차 베지어 위의 점 */
export function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** 3차 베지어의 접선 벡터 */
export function bezD(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
  return [
    a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]),
    a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]),
  ];
}

/** 곡선 위 t 지점의 단위 법선 */
export function normalAt(C, t) {
  const d = bezD(C[0], C[1], C[2], C[3], t);
  const l = Math.hypot(d[0], d[1]) || 1;
  return [-d[1] / l, d[0] / l];
}

/**
 * 중심선 C 위 t 지점에서 법선 방향으로 폭의 f 배만큼 떨어진 점.
 * f = 1이면 한쪽 가장자리, -1이면 반대쪽, 0이면 중심.
 */
export function pointAt(C, W, t, f = 0) {
  const p = bez(C[0], C[1], C[2], C[3], t);
  const n = normalAt(C, t);
  const w = (W(t) / 2) * f;
  return [p[0] + n[0] * w, p[1] + n[1] * w];
}

function toPath(points) {
  return 'M' + points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
}

/**
 * 두 오프셋 사이의 닫힌 띠.
 * band(C, W, 1, -1) 이면 형태 전체, band(C, W, -0.34, -1) 이면 음영 도형이 된다.
 */
export function band(C, W, f1, f2, N = 56, t0 = 0, t1 = 1) {
  const A = [], B = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    A.push(pointAt(C, W, t, f1));
    B.push(pointAt(C, W, t, f2));
  }
  return toPath(A.concat(B.reverse())) + 'Z';
}

/** 형태 전체의 외곽선 */
export function outline(C, W, N = 72) {
  return band(C, W, 1, -1, N);
}

/** 열린 오프셋 선 — 내부 구획선용 */
export function offsetLine(C, W, f, N = 48, t0 = 0, t1 = 1) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    pts.push(pointAt(C, W, t, f));
  }
  return toPath(pts);
}

/**
 * 결정론적 난수. 같은 시드는 항상 같은 그림을 만든다.
 * 결과 보드가 이미지 대신 시드만 저장할 수 있는 근거이므로 절대 Math.random()으로 바꾸지 말 것.
 */
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 위치 해시. `(시드, 정수들)` 의 순수 함수로 0~1 사이 실수를 돌려준다.
 *
 * rng() 는 부르는 순서에 값이 매여 있어서, 그리는 순서가 바뀌면 표본이 통째로 달라진다.
 * 시야를 옮기려면 "이 셀의 모양"이 언제 그리든 같아야 하므로, 순서 대신 좌표로 값을 정한다.
 * 첫 인자를 채널 번호로 쓰면 같은 좌표에서 서로 다른 값을 여러 개 뽑을 수 있다.
 */
export function hash(seed, ...ints) {
  let h = (seed | 0) ^ 0x9e3779b9;
  for (let i = 0; i < ints.length; i++) {
    h = Math.imul(h ^ (ints[i] | 0), 0x27220a95);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
