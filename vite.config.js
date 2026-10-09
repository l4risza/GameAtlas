import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// As páginas HTML antigas continuam no repositório como referência.
// Acesso direto às rotas atuais deve carregar a entrada React.
function reactPages() {
  const mount = (server) => { server.middlewares.use((req, _res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (/^\/(explorar|reviews|listas|perfil|login|cadastro|jogos-salvos|jogo)(\/|$)/.test(pathname)
      && req.headers.accept?.includes('text/html')) req.url = '/index.html'
    next()
  }) }
  return { name: 'gameatlas-react-pages', configureServer: mount, configurePreviewServer: mount }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001', changeOrigin: true },
  }
  return { plugins: [reactPages(), react()], server: { port: 5173, strictPort: true, proxy }, preview: { proxy } }
})
