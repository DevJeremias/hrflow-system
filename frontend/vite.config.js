import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { PONTO_THEME_COLOR } from './tailwind.config.js'

// O manifesto instalável e o tema do navegador usam o preenchimento âmbar da marca.
const corPrimaria = PONTO_THEME_COLOR

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    plugins: [
    react(),
    {
      name: 'hrflow-theme-color',
      transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: corPrimaria }, injectTo: 'head' }]
    },
    VitePWA({
      // O app novo só assume quando a pessoa aceita o aviso (components/AvisoDeAtualizacao.tsx):
      // trocar sozinho recarregaria a tela no meio de um formulário.
      registerType: 'prompt',
      workbox: {
        // A API nunca é servida pelo index.html do app, nem por link direto.
        navigateFallbackDenylist: [/^\/api\//]
      },
      manifest: {
        name: 'HRFlow - Gestão de RH',
        short_name: 'HRFlow',
        description: 'O seu portal do colaborador',
        lang: 'pt-BR',
        theme_color: corPrimaria,
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
    ]
  }
})
