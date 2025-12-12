import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SECURITY NOTE:
// This application stores the Gemini API key in the browser's localStorage
// rather than embedding it in the build. This prevents API key leakage in 
// the bundled code and gives users control over their own API keys.
// 
// The environment variable support below is optional and only for development.
// For production, users enter their API key through the UI.

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
