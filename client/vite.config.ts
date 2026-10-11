import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        // Same-origin API in dev, so the session cookie just works.
        '/api': 'http://localhost:4000',
        // Stands in for the rewrite in vercel.json when VITE_SUPABASE_PROXY is set.
        '/supabase': { target: env.VITE_SUPABASE_URL, changeOrigin: true, rewrite: (path) => path.replace(/^\/supabase/, '') },
      },
    },
  }
})
