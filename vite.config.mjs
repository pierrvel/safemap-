import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vercel 함수가 dist의 .js를 CommonJS로 바꿔 버려(export → exports) 화면이 하얗게 된다.
    // .mjs는 ES 모듈 그대로 두므로 번들 이름을 .mjs로 낸다.
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].mjs',
        chunkFileNames: 'assets/[name]-[hash].mjs',
      },
    },
  },
});
