import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import * as a from "valibot"
import { createResult, createResultError, type Result } from "#result"
import { codexImageResponseSchema } from "./codexImageResponseSchema.js"
import { imageAltClean } from "./imageAltClean.js"

export type CodexImageResult = {
  outputPath: string
  txtPath?: string
  revisedPrompt?: string
  usage?: unknown
}

const responseJsonSchema = a.pipe(a.string(), a.parseJson(), codexImageResponseSchema)

export function codexImageResultWrite(
  rawJson: string,
  prompt: string,
  outputPath: string,
  writeTxt: boolean,
): Result<CodexImageResult> {
  const op = "codexImageResultWrite"

  const parseResult = a.safeParse(responseJsonSchema, rawJson)
  if (!parseResult.success) return createResultError(op, a.summarize(parseResult.issues), rawJson)

  const parsed = parseResult.output
  const first = parsed.data[0]
  if (!first?.b64_json) return createResultError(op, "no b64_json in response", rawJson)

  try {
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, Buffer.from(first.b64_json, "base64"))

    let txtPath: string | undefined
    if (writeTxt) {
      txtPath = outputPath.replace(/\.[^.]*$/, ".txt")
      writeFileSync(txtPath, `${imageAltClean(prompt)}\n`)
    }

    return createResult({
      outputPath,
      txtPath,
      revisedPrompt: first.revised_prompt,
      usage: parsed.usage,
    })
  } catch (error) {
    return createResultError(op, error instanceof Error ? error.message : String(error))
  }
}
