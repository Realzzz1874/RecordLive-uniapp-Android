import { Agent as HttpsAgent } from 'node:https'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const ipv4HttpsAgent = new HttpsAgent({ family: 4 })

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
      '/shcstheatre-proxy': {
        target: 'https://m.shcstheatre.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shcstheatre-proxy/, ''),
      },
      '/shcstheatre-image-proxy': {
        target: 'https://pic.shcstheatre.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shcstheatre-image-proxy/, ''),
      },
      '/poly-proxy': {
        target: 'https://weixin.polyt.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/poly-proxy/, ''),
      },
      '/poly-image-proxy': {
        target: 'https://cdn.polyt.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/poly-image-proxy/, ''),
      },
      '/piaowutong-proxy': {
        target: 'https://m.piaowutong.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/piaowutong-proxy/, ''),
      },
      '/piaowutong-alt-proxy': {
        target: 'https://m.0368.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/piaowutong-alt-proxy/, ''),
      },
      '/piaowutong-image-proxy': {
        target: 'https://img.piaowutong.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/piaowutong-image-proxy/, ''),
      },
      '/cityline-proxy': {
        target: 'https://shows.cityline.com',
        changeOrigin: true,
        agent: ipv4HttpsAgent,
        rewrite: (path) => path.replace(/^\/cityline-proxy/, ''),
      },
      '/cityline-image-proxy': {
        target: 'https://shows.cityline.com',
        changeOrigin: true,
        agent: ipv4HttpsAgent,
        rewrite: (path) => path.replace(/^\/cityline-image-proxy/, ''),
      },
      '/chncpa-proxy': {
        target: 'https://openapi.chncpa.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chncpa-proxy/, ''),
      },
      '/chncpa-image-proxy': {
        target: 'https://www.chncpa.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chncpa-image-proxy/, ''),
      },
      '/bjconcerthall-proxy': {
        target: 'https://www.bjconcerthall.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bjconcerthall-proxy/, ''),
      },
      '/maitix-proxy': {
        target: 'https://client.maitix.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/maitix-proxy/, ''),
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            const value = request.headers['x-parse-origin']
            const origin = Array.isArray(value) ? value[0] : value
            if (!origin || !isAllowedMaitixOrigin(origin)) return
            proxyRequest.setHeader('Origin', origin)
            proxyRequest.setHeader('Referer', `${origin}/`)
            proxyRequest.removeHeader('X-Parse-Origin')
          })
        },
      },
      '/klook-short-proxy': {
        target: 'https://s.klook.cn',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/klook-short-proxy/, ''),
      },
      '/klook-link-proxy': {
        target: 'https://short.klook.cn',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/klook-link-proxy/, ''),
      },
      '/klook-proxy': {
        target: 'https://www.klook.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/klook-proxy/, ''),
      },
      '/klook-image-proxy': {
        target: 'https://res.klook.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/klook-image-proxy/, ''),
      },
    },
  },
})

function isAllowedMaitixOrigin(value: string): boolean {
  return /^https:\/\/(?:[a-z\d-]+\.)*maitix\.com$/i.test(value)
    || value === 'https://www.cadxy.cn'
}
