import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Anything the React app calls under /api gets forwarded to the Express server.
      // Avoids CORS friction during dev.
      '/api': 'http://localhost:4000',
    },
  },
});
