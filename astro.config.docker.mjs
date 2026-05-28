// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Used by the Dockerfile: `astro build --config astro.config.docker.mjs`
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});
