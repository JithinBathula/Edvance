
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';


export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  build: {
    target: 'esnext',
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ['src/**/*.test.ts', 'src/**/*test.tsx'],

  }
});