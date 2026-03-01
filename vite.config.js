import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF rendering libs — only needed when user exports; split from core bundle
          'vendor-pdf': ['jspdf', 'html2canvas', 'html-to-image'],
        },
      },
    },
    // Raise the warning threshold slightly; our vendor-pdf chunk will still be large by design
    chunkSizeWarningLimit: 600,
    sourcemap: true,
  },
})

