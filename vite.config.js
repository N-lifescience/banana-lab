import { defineConfig } from 'vite';

export default defineConfig({
  // 학교 네트워크에서 단일 파일로 배포해야 하는 경우가 있어 청크를 쪼개지 않는다.
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks: undefined }
    }
  },
  server: { port: 5173, open: false }
});
