import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { localFirstBuild } from './localBuild.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://127.0.0.1:4175'

  return {
    // The Pages build (`npm run build:pages`, mode "pages") is served from
    // https://taan1el.github.io/specship/, so assets need that subpath.
    // Every other build (dev, `npm run build`) serves from the domain root.
    base: mode === 'pages' ? '/specship/' : '/',
    plugins: [
      react(),
      // The Pages build is a local-first app: a Content-Security-Policy with no
      // external hosts, a web app manifest and an offline service worker.
      ...(mode === 'pages'
        ? [
            localFirstBuild({
              base: '/specship/',
              id: 'specship',
              name: 'SpecShip',
              description: 'A spec tracker that keeps every spec as a Markdown file in this browser.',
            }),
          ]
        : []),
    ],
    // Fonts stay files, never data: URIs, so the policy can forbid data: fonts.
    build: { assetsInlineLimit: mode === 'pages' ? 0 : undefined },
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
