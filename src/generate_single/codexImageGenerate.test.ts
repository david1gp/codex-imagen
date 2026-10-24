import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { codexImageGenerate } from "./codexImageGenerate.js"

const outputDir = join(tmpdir(), "codex-imagen-test")

describe("codexImageGenerate", () => {
  test("uses caller-provided client config and writes returned image bytes", async () => {
    rmSync(outputDir, { recursive: true, force: true })
    const outputPath = join(outputDir, "single.png")
    const pngHeader = Buffer.from("89504e470d0a1a0a", "hex")
    const calls: Array<{
      url: string
      authorization: string | null
      body: unknown
    }> = []

    const result = await codexImageGenerate({
      client: {
        baseUrl: "https://codex.example.test/v1/",
        apiKey: "test-token",
        requestTimeoutMs: 1_000,
        fetch: async (url, init) => {
          const headers = new Headers(init?.headers)
          calls.push({
            url: String(url),
            authorization: headers.get("authorization"),
            body: JSON.parse(String(init?.body)),
          })
          return new Response(
            JSON.stringify({
              created: 1,
              data: [
                {
                  b64_json: pngHeader.toString("base64"),
                  revised_prompt: "revised",
                },
              ],
              usage: { total_tokens: 1 },
            }),
            { status: 200, statusText: "OK" },
          )
        },
      },
      prompt: "small test image",
      outputPath,
      size: "1024x1024",
      background: "opaque",
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.errorMessage)
    expect(calls[0]?.url).toBe("https://codex.example.test/v1/images/generations")
    expect(calls[0]?.authorization).toBe("Bearer test-token")
    expect(calls[0]?.body).toMatchObject({
      prompt: "small test image",
      n: 1,
      size: "1024x1024",
    })
    expect(result.data.outputPath).toBe(outputPath)
    expect(result.data.revisedPrompt).toBe("revised")
    expect(existsSync(outputPath)).toBe(true)
    expect(readFileSync(outputPath).equals(pngHeader)).toBe(true)
    expect(readFileSync(outputPath.replace(/\.[^.]*$/, ".txt"), "utf8")).toBe("Small test image\n")
  })

  test("sends gpt-image-2.5 model, xhigh quality, and safety_identifier", async () => {
    rmSync(outputDir, { recursive: true, force: true })
    const outputPath = join(outputDir, "sunburst.png")
    const pngHeader = Buffer.from("89504e470d0a1a0a", "hex")
    const calls: Array<{ body: unknown }> = []

    const result = await codexImageGenerate({
      client: {
        baseUrl: "https://codex.example.test/v1/",
        apiKey: "test-token",
        requestTimeoutMs: 1_000,
        fetch: async (_url, init) => {
          calls.push({ body: JSON.parse(String(init?.body)) })
          return new Response(JSON.stringify({ created: 1, data: [{ b64_json: pngHeader.toString("base64") }] }), {
            status: 200,
            statusText: "OK",
          })
        },
      },
      prompt: "sunburst test image",
      outputPath,
      model: "gpt-image-2.5-sunburst",
      size: "2048x1152",
      quality: "xhigh",
      background: "transparent",
      outputFormat: "png",
      safetyIdentifier: "hashed-user-123",
      writeTxt: false,
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.errorMessage)
    expect(calls[0]?.body).toMatchObject({
      model: "gpt-image-2.5-sunburst",
      size: "2048x1152",
      quality: "xhigh",
      background: "transparent",
      safety_identifier: "hashed-user-123",
    })
    expect(existsSync(outputPath)).toBe(true)
  })
})
