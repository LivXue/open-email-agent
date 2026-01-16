import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Helper function to read .env file
function getEnvConfig() {
  const envPath = path.resolve(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0 && !line.trim().startsWith('#')) {
        envVars[key.trim()] = valueParts.join('=').trim()
      }
    })
    return envVars
  }
  return {}
}

const env = getEnvConfig()
const BACKEND_PORT = env.BACKEND_PORT || '8001'
const FRONTEND_PORT = env.FRONTEND_PORT || '3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(FRONTEND_PORT),
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
        // Add timeout for HTTP requests
        proxyTimeout: 30000,
        timeout: 30000,
      },
      '/ws': {
        target: `ws://localhost:${BACKEND_PORT}`,
        ws: true,
        changeOrigin: true,
        secure: false,
        // WebSocket specific options
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('WebSocket proxy error:', err);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
            console.log('WebSocket proxying to:', options.target);
          });
          proxy.on('close', (req, socket, head) => {
            console.log('WebSocket proxy connection closed');
          });
        },
      },
    },
  },
})
