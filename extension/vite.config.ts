import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  server: {
    port: 5175,
    strictPort: true,
    hmr: {
      port: 5175,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 禁止 code splitting，每个 entry 自包含
        manualChunks: undefined,
      },
    },
  },
})
