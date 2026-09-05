/**
 * 보고서에 싣는 모둠 조각 — 여덟 실험의 `report.js` 가 같은 것을 쓴다.
 *
 *   groupHeadRows(groupStore)         머리의 <dl> 에 끼울 줄 — 모둠원 별명
 *   memberAppendix(groupStore, keys)  「모둠원별 기록」 절 — 정리 문항에 각자 무엇을 썼는지
 *
 * 별명뿐이다. 이름·학번은 여기 없다 — 그것은 `who` 로 `head()` 가 따로 받는다.
 */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function groupHeadRows(groupStore) {
  if (!groupStore) return '';
  const me = groupStore.me;
  const nicks = [me.nick || '모둠장', ...groupStore.members().map((m) => m.nick)];
  return `<div><dt>모둠원(별명)</dt><dd>${nicks.map(esc).join(' · ')}</dd></div>`;
}

/**
 * @param {Array<{key:string,label:string}>} items  종이에 실을 문항과 그 이름
 */
export function memberAppendix(groupStore, items) {
  if (!groupStore || !groupStore.isLeader()) return '';
  const members = groupStore.members();
  if (members.length === 0) return '';
  const rows = members.map((m) => {
    const lines = items
      .map(({ key, label }) => ({ label, text: String(m.notes[key] ?? '').trim() }))
      .filter((l) => l.text)
      .map((l) => `<li><b>${esc(l.label)}</b><span>${esc(l.text)}</span></li>`).join('');
    return `<div class="rp-row"><h3>${esc(m.nick)}</h3>${
      lines ? `<ul class="rp-steps">${lines}</ul>` : '<p>적은 것이 없습니다</p>'}</div>`;
  }).join('');
  return `<section><h2>모둠원별 기록</h2><p class="rp-sub">각자 기기에서 쓴 것을 QR 로 모은 것입니다. 위의 정리는 이것을 토의해 모둠장이 고쳐 쓴 것입니다.</p>${rows}</section>`;
}
