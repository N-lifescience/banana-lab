/**
 * 실험대에 불이 들어오는 순간 — 자물쇠가 열릴 때 딱 한 번.
 *
 * 노트 1~4 쪽을 다 읽으면 실험대가 열린다. 앞서는 덮개가 **한 프레임에 사라졌다.**
 * 그러면 무슨 일이 일어났는지 눈이 못 따라간다 — 화면이 갑자기 달라져 있을 뿐이라,
 * 학생은 자기가 무엇을 얻었는지 모른 채 그냥 다음을 누른다.
 *
 * 「이 쪽을 읽었습니다」 넷을 눌러 온 것의 **보상**이 여기다. 그래서 세 가지를 한다 —
 *   ① 덮개가 걷힌다 (툭 꺼지지 않고 물러난다)
 *   ② 빛이 실험대를 한 번 훑고 지나간다
 *   ③ 물건이 **왼쪽부터 차례로** 깨어난다 — 한꺼번에 번쩍이면 번개고, 훑고 지나가면
 *      「불이 켜졌다」로 읽힌다. 차례는 물건의 x 자리에서 나온다
 *
 * ★ **한 번만 돈다.** 다시 그릴 때마다 돌면 실험 내내 깜빡이는 실험대가 된다.
 *   부르는 쪽(`renderLock`)이 **잠김 → 열림으로 바뀐 그 순간에만** 부른다.
 *
 * ★ **흔들림에 약한 사람에게는 움직임을 걷는다.** 덮개는 그대로 걷히고 훑는 빛만 없앤다 —
 *   효과를 통째로 끄면 그 사람만 「무슨 일이 일어났는지」를 못 본다.
 */

/** 훑는 빛이 지나가는 데 걸리는 시간. CSS 의 `bench-wake-sweep` 과 같아야 한다. */
const SWEEP_MS = 900;
/** 맨 오른쪽 물건이 깨어나기까지의 늦춤. 이보다 길면 「느리다」가 되고, 짧으면 한꺼번에 번쩍인다. */
const STAGGER_MS = 420;

/**
 * @param {HTMLElement} root      실험대 뿌리 (`.bench`)
 * @param {HTMLElement|null} lockEl  덮개 (`#bench-lock`). 없으면 건너뛴다.
 */
export function wakeBench(root, lockEl) {
  const stage = root?.querySelector('.bench-stage');
  if (!stage) return;

  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  // ① 덮개를 물린다. `hidden` 을 그 자리에서 켜면 트랜지션이 돌 틈이 없다.
  if (lockEl && !lockEl.hidden) {
    lockEl.classList.add('bench-lock--opening');
    const done = () => { lockEl.hidden = true; lockEl.classList.remove('bench-lock--opening'); };
    if (still) done();
    else lockEl.addEventListener('transitionend', done, { once: true });
    // 트랜지션이 안 도는 경우(탭이 숨겨져 있거나 CSS 가 안 실린 경우)에도 반드시 사라져야 한다.
    setTimeout(done, 600);
  }

  if (still) return;

  // ③ 물건마다 늦춤을 준다. **x 자리에서 뽑는다** — 배치는 사장님이 옮기시므로
  //    코드에 순서를 박아 두면 물건을 옮긴 순간 차례가 엉킨다.
  const tokens = [...stage.querySelectorAll('.token')];
  const xs = tokens.map((t) => t.getBoundingClientRect().left);
  const min = Math.min(...xs);
  const span = Math.max(...xs) - min || 1;
  tokens.forEach((t, i) => {
    t.style.setProperty('--wake-delay', `${Math.round(((xs[i] - min) / span) * STAGGER_MS)}ms`);
  });

  // ② 훑는 빛. 전용 칸을 하나 넣었다 빼낸다 — `.bench-stage` 의 가상 요소를 쓰면
  //    다른 곳에서 그 자리를 쓸 때 조용히 부딪힌다.
  const sweep = document.createElement('div');
  sweep.className = 'bench-wake';
  sweep.setAttribute('aria-hidden', 'true');
  stage.appendChild(sweep);

  root.classList.add('bench--waking');
  setTimeout(() => {
    root.classList.remove('bench--waking');
    sweep.remove();
    tokens.forEach((t) => t.style.removeProperty('--wake-delay'));
  }, SWEEP_MS + STAGGER_MS + 100);
}
