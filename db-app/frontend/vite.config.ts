import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 1. Create an alias so you can import clean paths like:
      // import { HistoryTable } from '@shared/components/HistoryTable'
      '@shared': path.resolve(__dirname, '../../shared-ui'),
    },
  },
  server: {
    fs: {
      // 2. Allow Vite to serve files from one level up (the root)
      // This is crucial for accessing the sibling directory.
      allow: ['..'],
    },
  },
})