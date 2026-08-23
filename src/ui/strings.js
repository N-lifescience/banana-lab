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

  /**
   * 탐구 노트. T04 에서 만든 heading/notesLabel 은 그대로 두고 T05 가 7단계 구조를 더한다.
   */
  notebook: {
    heading: '탐구 노트',
    notesLabel: '관찰 기록',

    stages: [
      { id: '1', title: '문제 인식' },
      { id: '2', title: '준비물' },
      { id: '3', title: '예상' },
      { id: '4', title: '탐구 과정' },
      { id: '5', title: '결과' },
      { id: '6', title: '정리' },
      { id: '7', title: '자기 평가' },
    ],
    problem: '생물체를 구성하는 물질 중 녹말과 지방을 어떻게 관찰할 수 있을까?',
    materialsHeading: '준비물',
    safetyHeading: '안전 유의 사항',
    safetyNotes: [
      '시약병을 쓴 뒤에는 마개를 바로 닫습니다.',
      '실험이 끝나면 손을 씻습니다.',
      '남은 시약과 폐액은 폐액통에 버립니다.',
    ],
    predictLabel: '이 슬라이드에서 무엇이 보일 것 같나요?',
    predictHeading: '내가 예상했던 것과 실제 결과를 견주어 보세요',
    actualLabel: '실제 결과',
    goalOnlyLabel: (title) => `이번 절차의 목표: ${title}`,
    noCaptures: '아직 기록된 결과가 없습니다. 현미경 확대 뷰에서 결과 기록 버튼을 눌러 보세요.',
    magInput: '배율 입력',
    magPlaceholder: '예: 400',
    qaLabel: 'ⓐ 아이오딘–아이오딘화 칼륨 용액과 수단 Ⅲ 용액을 떨어뜨리는 까닭은 무엇인가?',
    q2Label: '2. (나)와 (다)에서 관찰한 녹말과 지방의 분포를 비교해 써 보세요.',
    q3Label: '3. 다른 모둠의 결과와 비교해 써 보세요.',
    stepNotesHeading: '탐구 과정에서 적은 기록',
    reflectQuestion: (label) => `${label} 슬라이드의 상이 흐렸습니다. 무엇 때문이었을까요?`,
    reflectRetry: '다시 관찰하기',
    selfEvalItems: [
      { key: 'process', label: '절차를 순서대로 정확히 수행했는가' },
      { key: 'evidence', label: '관찰한 근거를 들어 결과를 설명했는가' },
    ],
    valuesLabel: '가치·태도 — 안전 규칙 준수',
    noViolations: '기록된 위반이 없습니다.',

    /** 자기 평가에 그대로 보여 줄 위반 기록 이름 (감점 없음) */
    violations: {
      'hands-unwashed': '손을 씻지 않았습니다.',
      'cap-left-open': '시약병 마개를 열어 두었습니다.',
      'waste-left': '폐액을 처리하지 않았습니다.',
    },
  },

  /** T04 — 되돌리기. undosLeft 가 Infinity 일 때는 숫자 대신 unlimited 를 쓴다 (1단계). */
  undo: {
    label: '되돌리기',
    unlimited: '무제한',
    left: (n) => `${n}회 남음`,
  },

  /**
   * T07 — 토스트 메시지 상세도 (난이도별). sim(rules.js)이 만드는 전체 메시지는 그대로 두고
   * (session.log 에 온전히 남아야 한다), 화면에 얼마나 보여줄지만 여기서 조절한다.
   * 1단계는 원인 메시지 뒤에 tag 별 "다음 행동"을 덧붙인다. 표에 없는 tag 는 원인만 보여 준다.
   */
  toast: {
    hidden: '결과가 나오지 않았습니다.',
    nextAction: {
      partial: '두 방울까지 마저 떨어뜨리세요.',
      bubbles: '덮개 유리를 들어 45°로 천천히 다시 덮어 보세요.',
      'skipped-low-mag': '저배율(40배)로 돌아가 초점을 먼저 맞추세요.',
      'too-thick': '새 슬라이드에 더 얇게 발라 보세요.',
      dark: '조리개를 더 여세요.',
      cracked: '슬라이드를 새로 만드세요.',
      'lens-touched': '덮개 유리를 덮은 새 슬라이드로 다시 시도하세요.',
      'edge-seep': '덮개 유리를 덮기 전에 용액을 떨어뜨리세요.',
      'early-cover': '색 변화가 끝날 때까지 기다렸다가 덮으세요.',
      overflow: '스포이트를 씻고 두 방울만 다시 떨어뜨리세요.',
      excess: '두 방울이 가장 선명하게 보입니다.',
      'cross-contamination': '스포이트를 폐액통에 씻은 뒤 다시 채우세요.',
      'blurry-capture': '미동나사로 초점을 맞춘 뒤 다시 기록하세요.',
      'no-coverslip': '핀셋으로 덮개 유리를 덮은 뒤 다시 올려 보세요.',
      'undo-exhausted': '남은 되돌리기가 없습니다. 다음부터는 신중하게 조작하세요.',
    },
  },
};
