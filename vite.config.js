import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from /br-380/ on GitHub Pages.
// Local dev (vite dev) ignores base, so http://localhost:5173/ still works.
export default defineConfig({
  plugins: [react()],
  base: '/br-380/',
})
