import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  console.log('Token loaded:', env.DATABRICKS_TOKEN ? 'YES (length: ' + env.DATABRICKS_TOKEN.length + ')' : 'NO')
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, '../../shared-ui/src'),
      },
    },
    server: {
      fs: {
        allow: ['..'],
      },
      proxy: {
        '/api': {
          target: 'https://better-table-alex-feng-1444828305810485.aws.databricksapps.com',
          changeOrigin: true,
          secure: true,
          headers: {
            'Authorization': `Bearer ${env.DATABRICKS_TOKEN}`
          },
        },
      },
    },
  }
})