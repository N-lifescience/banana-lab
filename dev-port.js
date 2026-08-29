/**
 * 이 클론의 개발 서버 포트 — 한 군데에서만 정한다.
 *
 * 왜 상수로 빼는가: 실험마다 저장소를 통째로 복제해 **여러 세션이 동시에** 돈다
 * (`LAUNCH.md` §3). 포트가 전부 같으면 두 번째 세션의 `npm run dev` 는 5173 이 차 있는
 * 것을 보고 **조용히 옆 포트로 밀려난다.** 그런데 검사 스크립트는 여전히 5173 을 보므로
 * 남의 앱을 검사하고 초록불을 낸다 — 자기 화면은 한 번도 열어 보지 않고서.
 * 못 잡는 것보다 나쁘다. 잡았다고 착각하게 만든다.
 *
 * 그래서 포트를 못 박고(`strictPort`), 스크립트가 같은 값을 읽게 한다.
 * 밀려나느니 **아예 안 뜨는 편이 낫다** — 안 뜨면 사람이 안다.
 *
 * 새 실험을 복제했으면 **이 파일의 숫자 하나만** 바꾼다. 실험별 배정은 `LAUNCH.md` §7.
 */
export const DEV_PORT = 5173;

/** 빌드본 확인용(`npm run preview`). 개발 포트를 따라오게 두어 바꿀 숫자를 하나로 유지한다. */
export const PREVIEW_PORT = DEV_PORT + 1000;

/** 검사 스크립트의 기본 주소. `BASE` / `SHOT_URL` 로 여전히 덮을 수 있다. */
export const devUrl = (path = '') => `http://localhost:${DEV_PORT}${path}`;
export const previewUrl = (path = '') => `http://localhost:${PREVIEW_PORT}${path}`;

/*
 * **실험 하나가 사는 자리.**
 *
 * 합치기 전에는 실험이 뿌리에 있어서 `devUrl('/?level=1')` 이면 됐다. 이제 실험은
 * `experiments/<id>/` 아래 있고, 뿌리는 **실험을 고르는 첫 화면**이다.
 *
 * ★ **검사 스크립트가 저마다 그 경로를 적어 두면 실험을 옮길 때 네 곳을 고치게 된다.**
 *   한 곳에서 만든다 — 「사본이 셋이면 하나는 떠 있다」(PLAYBOOK).
 *   그리고 옮긴 것을 깜빡하면 **검사가 첫 화면에 대고 실험을 찾다가 멎는다.**
 *   실제로 그랬고, 바닥 관문이 「0/3 까지 통과한 뒤 멎었습니다」로 잡았다.
 */
export const expPath = (id) => `/experiments/${id}/`;
export const expUrl = (id, query = '') => devUrl(`${expPath(id)}${query}`);
export const expPreviewUrl = (id, query = '') => previewUrl(`${expPath(id)}${query}`);
