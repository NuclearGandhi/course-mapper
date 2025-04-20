import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/course-mapper/', // Add this line - should match your repository name
  build: {
    rollupOptions: {
      input: {
        main: resolve(new URL('index.html', import.meta.url).pathname),
      },
    },
  },
  publicDir: 'public',
  // Copy data directory files to build output
  assetsInclude: ['**/*.json', '**/*.csv'],
})
