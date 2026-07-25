// Gap code registry + sanitizer (guardrail #9). Public surfaces see only a stable code and one
// human sentence; the raw provider/system error goes to server logs and never to the user.

export type GapCode =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_BADJSON'
  | 'PROVIDER_QUOTA'
  | 'PROVIDER_ERROR'
  | 'COST_CAP'
  | 'EXTRACT_UNGROUNDED'
  | 'FETCH_BLOCKED'
  | 'FETCH_DEAD'
  | 'FETCH_TOO_LARGE'
  | 'INGEST_TOO_LARGE'
  | 'INGEST_UNSUPPORTED'
  | 'INGEST_EMPTY'
  | 'INGEST_HOSTILE'

const GAP_MESSAGES: Record<GapCode, string> = {
  PROVIDER_TIMEOUT: 'A model took too long — delivered with a coverage note.',
  PROVIDER_BADJSON: 'A model returned a malformed response — delivered with a coverage note.',
  PROVIDER_QUOTA: 'A model provider was over quota — delivered with a coverage note.',
  PROVIDER_ERROR: 'A model provider was unavailable — delivered with a coverage note.',
  COST_CAP: 'This dossier reached its processing budget — delivered with a coverage note.',
  EXTRACT_UNGROUNDED: 'We dropped a statement we could not trace to your evidence.',
  FETCH_BLOCKED: 'A link could not be checked safely and was not marked live.',
  FETCH_DEAD: 'A link did not resolve and was not marked live.',
  FETCH_TOO_LARGE: 'A linked page was too large to check and was not marked live.',
  INGEST_TOO_LARGE: 'A file exceeded the size limit and was skipped.',
  INGEST_UNSUPPORTED: 'A file type is not supported and was skipped.',
  INGEST_EMPTY: 'A file had no readable text and was skipped.',
  INGEST_HOSTILE: 'A file failed safe document checks and was skipped.',
}

export interface Gap {
  code: GapCode
  message: string
}

// Returns ONLY the stable code + human sentence. The raw error is never included in the return
// value — pass it to logRaw() instead so it lands in server logs only.
export function sanitizeGap(code: GapCode): Gap {
  return { code, message: GAP_MESSAGES[code] }
}

let sink: (line: string) => void = (line) => console.error(line)

// For tests: capture raw log lines instead of writing to stderr.
export function setRawSink(fn: (line: string) => void): void {
  sink = fn
}

export function logRaw(code: GapCode, rawError: unknown): void {
  const detail = rawError instanceof Error ? (rawError.stack ?? rawError.message) : String(rawError)
  sink(`[gap:${code}] ${detail}`)
}
