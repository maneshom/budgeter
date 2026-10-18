import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MoneyUndo — Budgeting & Expense Tracking',
        short_name: 'MoneyUndo',
        description: 'Flexible budgeting and expense tracking for everyday life.',
        theme_color: '#6d28d9',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'moneyundo-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'moneyundo-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'moneyundo-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  base: process.env.NODE_ENV === 'production' ? '/budgeter/' : '/',
})