import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { execSync } from 'child_process';

// Stamp the bundle with its source commit + build time so a device can be
// checked for a stale embedded bundle (Account page > diagnostics line).
// The sha is the commit the build ran FROM (bundles are built before the
// resync commit itself), which is exact enough to date a bundle.
function computeBuildStamp(): string {
  let sha = 'nogit';
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // Keep building outside a git checkout (CI tarballs, etc.).
  }
  const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${sha} ${builtAt}Z`;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __HIM_BUILD_STAMP__: JSON.stringify(computeBuildStamp()),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
