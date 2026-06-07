import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'HRFlow - Gestão de RH',
        short_name: 'HRFlow',
        description: 'O seu portal do colaborador',
        theme_color: '#2563EB',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192', // <-- A vírgula salvadora está aqui
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512', // <-- E aqui também
            type: 'image/png'
          }
        ]
      }
    })
  ]
})