import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { codexImageEdit } from "./codexImageEdit.js"

const outputDir = join(tmpdir(), "codex-imagen-test-edit")

describe("codexImageEdit", () => {
  test("sends gpt-image-2 in the edit form", async () => {
    rmSync(outputDir, { recursive: true, force: true })
    mkdirSync(outputDir, { recursive: true })
    const inputPath = join(outputDir, "input.png")
    writeFileSync(inputPath, Buffer.from("input-image"))
    const outputPath = join(outputDir, "edited.png")
    const pngHeader = Buffer.from("89504e470d0a1a0a", "hex")
    let form: FormData | undefined

    const result = await codexImageEdit({
      client: {
        baseUrl: "https://codex.example.test/v1/",
        apiKey: "test-token",
        requestTimeoutMs: 1_000,
        fetch: async (_url, init) => {
          form = init?.body as FormData
          return new Response(JSON.stringify({ created: 1, data: [{ b64_json: pngHeader.toString("base64") }] }), {
            status: 200,
            statusText: "OK",
          })
        },
      },
      inputImagePath: inputPath,
      prompt: "gpt-image-2 edit test",
      outputPath,
      model: "gpt-image-2",
      writeTxt: false,
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.errorMessage)
    expect(form).toBeDefined()
    if (!form) throw new Error("mock provider did not receive a form")
    expect(form.get("model")).toBe("gpt-image-2")
    expect(form.get("quality")).toBe("auto")
    expect(form.get("background")).toBe("auto")
    expect(existsSync(outputPath)).toBe(true)
  })

  test("rejects gpt-image-2 options codex-lb cannot serve without issuing fetch", async () => {
    rmSync(outputDir, { recursive: true, force: true })
    mkdirSync(outputDir, { recursive: true })
    const inputPath = join(outputDir, "input.png")
    writeFileSync(inputPath, Buffer.from("input-image"))
    const cases: Array<{ name: string; options: Record<string, unknown>; message: string }> = [
      { name: "xhigh quality", options: { quality: "xhigh" }, message: "quality 'xhigh' is not supported" },
      { name: "max quality", options: { quality: "max" }, message: "quality 'max' is not supported" },
      {
        name: "transparent background",
        options: { background: "transparent" },
        message: "background 'transparent' is not supported",
      },
      { name: "complexity", options: { complexity: "low" }, message: "complexity is not supported" },
      {
        name: "safetyIdentifier",
        options: { safetyIdentifier: "hashed-user-123" },
        message: "safetyIdentifier is not supported",
      },
    ]
    for (const { name, options, message } of cases) {
      let fetchCalls = 0
      const result = await codexImageEdit({
        client: {
          baseUrl: "https://codex.example.test/v1/",
          apiKey: "test-token",
          requestTimeoutMs: 1_000,
          fetch: async () => {
            fetchCalls += 1
            return new Response("{}", { status: 200, statusText: "OK" })
          },
        },
        inputImagePath: inputPath,
        prompt: `gpt-image-2 gate: ${name}`,
        outputPath: join(outputDir, "gated.png"),
        model: "gpt-image-2",
        ...options,
      } as Parameters<typeof codexImageEdit>[0])

      expect(result.success).toBe(false)
      if (result.success) throw new Error(`expected gpt-image-2 gate to fail for ${name}`)
      expect(result.errorMessage).toContain(message)
      expect(fetchCalls).toBe(0)
    }
  })
})
