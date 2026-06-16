import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src/webview',
  base: './',
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'elkjs/lib/elk.bundled.js'],
  },
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    target: 'es2022',
    // Webview assets load from local disk; network-size thresholds don't apply.
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
})
