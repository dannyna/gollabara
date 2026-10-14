import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const api = 'http://127.0.0.1:4747'

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  server: {
    port: 4748,
    proxy: {
      '/api': api,
      '/img': api,
      '/ws': { target: api.replace('http', 'ws'), ws: true },
    },
  },
})
