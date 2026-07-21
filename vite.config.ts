import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/yyj-proxy': {
        target: 'https://y.saoju.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yyj-proxy/, ''),
      },
      '/myukit-proxy': {
        target: 'https://myukit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/myukit-proxy/, ''),
      },
    },
  },
})
