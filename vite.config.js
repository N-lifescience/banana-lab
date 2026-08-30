import { defineConfig } from 'vite';
import { DEV_PORT, PREVIEW_PORT } from './dev-port.js';

export default defineConfig({
  // 학교 네트워크에서 단일 파일로 배포해야 하는 경우가 있어 청크를 쪼개지 않는다.
  build: {
    target: 'es2022',
    rollupOptions: {
      // 개인정보처리방침은 앱과 따로 도는 정적 문서다. 자바스크립트가 필요 없으므로
      // 진입점으로만 넣어 둔다 (harness.html 은 개발용이라 배포본에 넣지 않는다).
      /*
       * ★ **실험이 늘면 여기 한 줄이 는다.** 실험 하나 = 진입점 하나다.
       *   `main` 은 이제 **실험 고르는 첫 화면**이고, 실험은 `experiments/<id>/index.html` 이다.
       *   (합치기 2단계, 2026-08-29 — `MERGE-AND-DEPLOY.md` §4)
       */
      input: {
        main: 'index.html',                                   // 실험 고르는 첫 화면
        privacy: 'privacy.html',                              // 사이트 전체 것
        banana: 'experiments/banana/index.html',
        micrometer: 'experiments/micrometer/index.html',
        osmosis: 'experiments/osmosis/index.html',
        catalase: 'experiments/catalase/index.html',
        centrifuge: 'experiments/centrifuge/index.html',
        /*
         * 선생님이 수업을 열고 제출물을 받는 화면. **사이트에 하나뿐이다** —
         * 어느 실험의 수업인지는 주소(`?exp=`)로 정한다. 실험이 늘어도 이 줄은 안 는다.
         * (합치기 4단계, 2026-08-30 — 여덟 저장소가 바이트까지 같아 가장 먼저 올렸다)
         */
        teacher: 'teacher.html',
      },
      output: { manualChunks: undefined }
    }
  },
  // strictPort 인 이유는 dev-port.js 에 적어 두었다 — 밀려나느니 안 뜨는 편이 낫다.
  server: { port: DEV_PORT, strictPort: true, open: false },
  preview: { port: PREVIEW_PORT, strictPort: true, open: false }
});
