import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * FE2-7 (FE-009): produkcijski build MORA znati API base URL.
 *
 * `frontend/Dockerfile` deklariše `ARG VITE_API_URL` bez defaulta. Prije ove
 * provjere build bez tog arga nije padao — samo bi u `dist/` ugradio prazan
 * base, a `api.ts` je imao `|| 'http://localhost:3020/api'` fallback, pa je
 * deployovana aplikacija tiho zvala korisnikov vlastiti localhost.
 *
 * Guard je namjerno ovdje (build-time), a NE u `api.ts` (runtime):
 *  - `api.ts` se importuje i u Vitest testovima, gdje `VITE_API_URL` nije
 *    postavljen — runtime throw bi srušio cijeli test suite;
 *  - greška u buildu je jedini trenutak kad se problem može ispraviti.
 *
 * `command !== 'build'` preskače `vite dev` i Vitest (oba idu kao 'serve').
 */
function requireApiBaseUrl(): Plugin {
  return {
    name: 'fe2-7-require-api-base-url',
    config(_config, env) {
      if (env.command !== 'build') return
      // `loadEnv` čita i `process.env` i `.env*` fajlove (process.env ima
      // prednost), pa vrijedi isto što će Vite kasnije ugraditi u bundle.
      const value = (loadEnv(env.mode, process.cwd(), 'VITE_').VITE_API_URL ?? '').trim()
      if (value) return
      throw new Error(
        [
          'FE2-7: VITE_API_URL nije postavljen, a ovo je produkcijski build.',
          '',
          'Bez njega bundle ne zna gdje je API, a nekadašnji fallback je bio',
          "http://localhost:3020/api - deployovana aplikacija bi zvala korisnikov",
          'vlastiti localhost. Build zato namjerno pada.',
          '',
          'Ispravka:',
          '  - docker/compose: proslijedi build arg VITE_API_URL',
          '    (produkcijska vrijednost: https://api.boiler-control.ba101.top/api)',
          '  - lokalni build:  VITE_API_URL=... npm run build',
          '  - lokalni dev:    upisi VITE_API_URL=... u frontend/.env.local',
          '                    (gitignored; sablon: frontend/.env.example)',
        ].join('\n')
      )
    }
  }
}

export default defineConfig({
  plugins: [requireApiBaseUrl(), react()],
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
