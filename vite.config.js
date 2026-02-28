import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF rendering libs — only needed when user exports; split from core bundle
          'vendor-pdf': ['jspdf', 'html2canvas', 'html-to-image'],
          // Charting lib — large but used on almost every view, gets its own chunk
          'vendor-charts': ['recharts'],
        },
      },
    },
    // Raise the warning threshold slightly; our vendor-pdf chunk will still be large by design
    chunkSizeWarningLimit: 600,
  },
})

