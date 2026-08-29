/**
 * 주석을 걷어내고 **코드와 문자열만** 남긴다.
 *
 * ★ 이걸 안 쓰면 원본을 읽는 검사가 **자기 주석을 문다.**
 *   「`disabled` 로 막지 마세요」를 주석에 적는 순간 그 자리에서 빨간불이 뜨고,
 *   다음 사람은 규칙을 적어 두는 대신 지운다 — **검사가 문서를 쫓아내는 것**이다.
 *   실제로 두 번 걸렸다 (`ui.contract.test.js` · `notebook.steps.test.js`).
 *
 * ★ **문자열은 남긴다.** 문자열에 든 `disabled` 는 진짜로 화면에 나간다.
 *
 * 이 파일은 `.test.js` 가 아니라 `node --test` 가 테스트로 집지 않는다
 * (`package.json` 의 글롭이 `tests/**\/*.test.js` 다).
 *
 * **줄 하나가 통째로 주석인 것만 지운다.** 코드 뒤에 꼬리로 붙은 `// …` 는 남는데,
 * 이 저장소의 규칙 설명은 전부 제 줄에 있으므로 잡으려는 것은 다 잡힌다.
 *
 * @param {string} src  자바스크립트나 HTML 원본
 * @returns {string}    통째로 주석인 줄이 빠진 것
 */
export function stripComments(src) {
  /**
   * **줄 단위로 지운다.** 글자를 하나씩 훑는 방식은 정규식 리터럴(`/['\"]/`)이나
   * 따옴표가 든 문자열에서 상태를 잃고, 한 번 잃으면 **그 뒤 전부가 문자열로 보여**
   * 주석이 안 지워진다. 실제로 그렇게 어긋났고, 줄 번호로도 찾기 어려웠다.
   *
   * 줄 단위는 상태가 없어 어긋날 자리가 없다. 이 검사가 보려는 것은
   * 「주석에 적은 규칙 때문에 빨간불이 뜨는가」 하나라, 이만큼이면 충분하다.
   */
  const out = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    // 통째로 주석인 줄 — JSDoc 의 ` * ` 줄이 여기 다 걸린다.
    if (line.startsWith('*') || line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inBlock = true;   // HTML 주석도 같은 자리에서 닫는다
      continue;
    }
    out.push(raw);
  }
  return out.join('\n');
}
