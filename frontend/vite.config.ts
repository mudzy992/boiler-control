import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 80
  },
  build: {
    /**
     * FE2-4 (FE-004): vendor čipovi odvojeni od koda aplikacije.
     *
     * Bez ovoga `npm run build` je proizvodio jedan čip od 2.975,35 kB
     * (gzip 906,26 kB — izmjereno 2026-10-30). Razdvajanje po biblioteci znači
     * da se promjena koda aplikacije NE poništava keš preglednika za antd,
     * react i slično — oni ostaju isti fajl između deploya.
     *
     * Grupisanje je po **porodici** paketa, ne po pojedinačnom paketu: antd
     * vuče `rc-*` / `@rc-component/*`, a `@ant-design/plots` vuče `@antv/*` i
     * `d3-*`. Dijeliti roditelja od njegove zavisnosti u dva čipa rizikuje
     * greške inicijalizacije pri pokretanju, pa idu zajedno.
     *
     * `@ant-design/plots` se provjerava PRIJE `@ant-design/icons` jer oba
     * počinju s `@ant-design/`.
     */
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return

          if (
            id.includes('@ant-design/plots') ||
            id.includes('@antv') ||
            id.includes('/d3-')
          ) {
            return 'vendor-plots'
          }
          if (id.includes('@ant-design/icons')) return 'vendor-icons'
          if (
            id.includes('/antd/') ||
            id.includes('/rc-') ||
            id.includes('@rc-component')
          ) {
            return 'vendor-antd'
          }
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('/react-router') || id.includes('@remix-run')) {
            return 'vendor-router'
          }
          if (id.includes('/@tanstack/')) return 'vendor-query'
          if (id.includes('/i18next/') || id.includes('/react-i18next/')) {
            return 'vendor-i18n'
          }
          if (id.includes('/axios/') || id.includes('/dayjs/')) {
            return 'vendor-utils'
          }
        }
      }
    }
  }
})
