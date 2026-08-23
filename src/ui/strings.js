/**
 * 화면에 보이는 한국어 문자열은 전부 여기 모은다.
 * 코드에 직접 쓰면 문구를 다듬을 때마다 로직 파일을 열어야 한다.
 */

export const UI = {
  appTitle: '바나나에서 탄수화물과 지질 관찰하기',
  harnessTitle: '개발 확인용 하네스',
  harnessNote: '실제 시뮬레이터 화면이 아니라, 애셋과 시야 렌더러가 살아 있는지 보는 페이지입니다. T04에서 진짜 UI로 교체합니다.',

  slides: { A: '(가) 대조군', B: '(나) 아이오딘–아이오딘화 칼륨', C: '(다) 수단 Ⅲ' },
  reagents: { NONE: '없음', IKI: '아이오딘–아이오딘화 칼륨', SUDAN3: '수단 Ⅲ' },

  controls: {
    ripe: '익은 정도',
    peel: '껍질 벗김',
    reagent: '검출 용액',
    drops: '떨어뜨린 방울 수',
    objective: '대물렌즈',
    focus: '초점 (미동나사)',
    diaphragm: '조리개',
    thickness: '시료 두께',
  },

  units: { drops: (n) => `${n}방울`, mag: (n) => `${n}배` },

  observability: {
    label: '관찰 가능성',
    worst: {
      drops: '방울 수',
      focus: '초점',
      brightness: '광량',
      thickness: '시료 두께',
      bubbles: '기포',
      magnification: '배율',
      lens: '렌즈 오염',
    },
    hint: (worst) => `지금 가장 크게 깎이는 항목: ${worst}`,
  },

  /**
   * 절차 안내. 지시일 뿐 조건이 아니다 — 지키지 않아도 진행된다.
   * 실패 문구는 rules.js 가 상황마다 만들어 내므로 여기 두지 않는다.
   */
  protocol: [
    { id: '1', title: '바나나 준비', steps: ['껍질 벗기기', '받침 유리 (가)(나)(다) 꺼내기'] },
    { id: '2', title: '시료 도포', steps: ['(가)에 문지르기', '(나)에 문지르기', '(다)에 문지르기'] },
    { id: '3', title: '(나) 아이오딘 처리', steps: ['스포이트 채우기', '두 방울 떨어뜨리기', '색 변화 관찰', '스포이트 씻기'] },
    { id: '4', title: '(다) 수단 Ⅲ 처리', steps: ['스포이트 채우기', '두 방울 떨어뜨리기', '색 변화 관찰'] },
    { id: '5', title: '덮개 유리', steps: ['(가) 덮기', '(나) 덮기', '(다) 덮기'] },
    { id: '6', title: '현미경 관찰', steps: ['저배율 초점', '고배율 전환', '조리개 조절', '결과 기록 ×3'] },
  ],

  /** T04 — 실험대 위 물건 이름. 토큰의 aria-label 로 쓴다. */
  bench: {
    heading: '실험대',
    items: {
      banana: '바나나',
      slideA: '받침 유리 (가)',
      slideB: '받침 유리 (나)',
      slideC: '받침 유리 (다)',
      coverslip: '덮개 유리',
      dropper: '스포이트',
      forceps: '핀셋',
      bottleIKI: '아이오딘–아이오딘화 칼륨 병',
      bottleSUDAN: '수단 Ⅲ 병',
      dish: '실험 접시',
      microscope: '현미경',
      waste: '폐액통',
      tissue: '휴지',
    },
  },

  /** T04 — 확대 뷰 (슬라이드 제작 / 현미경 관찰) */
  zoom: {
    close: '닫기 (Esc)',
    slideMode: (label) => `${label} — 슬라이드 제작`,
    scopeMode: '현미경 관찰',
    emptyStage: '재물대에 슬라이드가 없습니다. 슬라이드를 현미경으로 끌어다 놓으세요.',
    coverAngle: '덮개 유리를 놓는 각도',
    placeCoverslip: '덮개 유리 덮기',
    capture: '결과 기록',
    coarseGroup: '조동나사',
    coarseFocusIn: '조동나사 ▲',
    coarseFocusOut: '조동나사 ▼',
  },

  /** T04 — 탐구 노트 */
  notebook: {
    heading: '탐구 노트',
    notesLabel: '관찰 기록',
  },

  /** T04 — 되돌리기. undosLeft 가 Infinity 일 때는 숫자 대신 unlimited 를 쓴다 (1단계). */
  undo: {
    label: '되돌리기',
    unlimited: '무제한',
    left: (n) => `${n}회 남음`,
  },
};
