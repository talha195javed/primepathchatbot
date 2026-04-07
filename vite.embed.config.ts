import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Build config for the embeddable widget script
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/embed.tsx'),
      name: 'PrimePathChatWidget',
      formats: ['iife'],
      fileName: () => 'embed.js',
    },
    outDir: 'dist-embed',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
