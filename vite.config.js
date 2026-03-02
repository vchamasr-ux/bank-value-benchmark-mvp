import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core dependencies
          'vendor-react': ['react', 'react-dom'],
          // Recharts — isolated because it's heavy
          'vendor-charts': ['recharts'],
          // PDF rendering libs — only needed when user exports; split from core bundle
          'vendor-pdf': ['jspdf', 'html-to-image'],
        },
      },
    },
    // Raise the warning threshold slightly; our vendor-pdf chunk will still be large by design
    chunkSizeWarningLimit: 600,
    sourcemap: true,
  },
})

