// @ts-check
import { defineConfig } from 'astro/config';
import node    from '@astrojs/node';
import vercel  from '@astrojs/vercel';
import react   from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Use the Vercel adapter when deploying to Vercel (VERCEL env var is auto-set).
// Fall back to the Node standalone adapter for Docker / local dev.
const isVercel = !!process.env.VERCEL;

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isVercel ? vercel() : node({ mode: 'standalone' }),
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});