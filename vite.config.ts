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
      '/damai-proxy': {
        target: 'https://detail.damai.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/damai-proxy/, ''),
      },
      '/damai-image-proxy': {
        target: 'https://img.alicdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/damai-image-proxy/, ''),
      },
      '/maoyan-proxy': {
        target: 'https://www.gewara.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/maoyan-proxy/, ''),
      },
      '/maoyan-image-proxy': {
        target: 'https://p0.meituan.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/maoyan-image-proxy/, ''),
      },
      '/showstart-proxy': {
        target: 'https://www.showstart.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/showstart-proxy/, ''),
      },
      '/showstart-image-proxy': {
        target: 'https://s2.showstart.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/showstart-image-proxy/, ''),
      },
    },
  },
})
