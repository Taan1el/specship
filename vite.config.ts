import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://127.0.0.1:4175'

  return {
    // The Pages build (`npm run build:pages`, mode "pages") is served from
    // https://taan1el.github.io/specship/, so assets need that subpath.
    // Every other build (dev, `npm run build`) serves from the domain root.
    base: mode === 'pages' ? '/specship/' : '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': apiTarget,
      },
    },
    test: {
      environment: 'jsdom',
      exclude: ['dist/**', 'dist-server/**', 'node_modules/**'],
      setupFiles: './src/test/setup.ts',
    },
  }
})
