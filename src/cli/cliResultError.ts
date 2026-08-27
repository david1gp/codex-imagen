import type { ResultErr } from "#result"

export function cliResultError(result: ResultErr): Error {
  return new Error(`${result.op}: ${result.errorMessage}`)
}
