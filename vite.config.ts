import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4175',
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['dist/**', 'dist-server/**', 'node_modules/**'],
    setupFiles: './src/test/setup.ts',
  },
})
