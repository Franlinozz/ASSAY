import { Store } from '../src/store'
import { loadConfig } from '../src/config'
import { runDossierPipeline } from '../src/jobs'
import { createModeFetcher, createRouter, SAMPLE_RESUME_TEXT } from '@xyndicate/providers'
import { htmlToPdf } from '@xyndicate/renderers'

const cfg = loadConfig()
const store = new Store(cfg.dbPath, cfg.filesDir)
try {
  const { dossierId, result } = await runDossierPipeline(
    {
      store,
      cfg,
      router: createRouter(),
      fetcher: createModeFetcher(),
      toPdf: htmlToPdf,
      realPdf: true,
    },
    {
      resumeText: SAMPLE_RESUME_TEXT,
      variant: 'promotion',
      jd: 'Promotion to Staff Engineer: demonstrate sustained technical impact, leadership, and cross-team scope.',
      dateFrom: '2021-03',
      dateTo: '2026-07',
    },
  )
  const artifacts = Array.isArray(result['artifacts']) ? result['artifacts'] : []
  process.stdout.write(
    `${JSON.stringify(
      {
        dossierId,
        providerMode: process.env['ASY_PROVIDER_MODE'] ?? 'fake',
        variant: 'promotion',
        artifacts: artifacts.map((a) => (a as { kind?: string }).kind),
        tribunal: result['tribunal'],
        seal: result['seal'],
      },
      null,
      2,
    )}\n`,
  )
} finally {
  store.close()
}
