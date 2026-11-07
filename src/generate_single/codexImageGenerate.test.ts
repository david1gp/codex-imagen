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

  test("sends gpt-image-2.6 model, xhigh quality, and safety_identifier", async () => {
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
      model: "gpt-image-2.6-sunburst",
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
      model: "gpt-image-2.6-sunburst",
      size: "2048x1152",
      quality: "xhigh",
      background: "transparent",
      safety_identifier: "hashed-user-123",
    })
    expect(existsSync(outputPath)).toBe(true)
  })

  test("sends complexity and GIF frame options without output compression", async () => {
    rmSync(outputDir, { recursive: true, force: true })
    const outputPath = join(outputDir, "animation.gif")
    const gifHeader = Buffer.from("474946383961", "hex")
    const calls: Array<{ body: unknown }> = []

    const result = await codexImageGenerate({
      client: {
        baseUrl: "https://codex.example.test/v1/",
        apiKey: "test-token",
        requestTimeoutMs: 1_000,
        fetch: async (_url, init) => {
          calls.push({ body: JSON.parse(String(init?.body)) })
          return new Response(JSON.stringify({ created: 1, data: [{ b64_json: gifHeader.toString("base64") }] }), {
            status: 200,
            statusText: "OK",
          })
        },
      },
      prompt: "a monkey lifts a glowing lantern",
      outputPath,
      model: "gpt-image-2.6-flare",
      size: "auto",
      outputFormat: "gif",
      complexity: "low",
      frameCount: 9,
      frameDurationMs: 200,
      writeTxt: false,
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.errorMessage)
    expect(calls[0]?.body).toMatchObject({
      model: "gpt-image-2.6-flare",
      output_format: "gif",
      complexity: "low",
      frame_count: 9,
      frame_duration_ms: 200,
    })
    expect(calls[0]?.body).not.toHaveProperty("output_compression")
    expect(existsSync(outputPath)).toBe(true)
    expect(readFileSync(outputPath).equals(gifHeader)).toBe(true)
  })

  test("rejects frame options without gif output", async () => {
    const result = await codexImageGenerate({
      client: {
        baseUrl: "https://codex.example.test/v1/",
        apiKey: "test-token",
      },
      prompt: "frame options without gif",
      outputPath: join(outputDir, "rejected.png"),
      frameCount: 9,
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected frame validation to fail")
    expect(result.errorMessage).toContain("frameCount and frameDurationMs require outputFormat 'gif'")
  })

  test("sends gpt-image-2 with default options", async () => {
    rmSync(outputDir, { recursive: true, force: true })
    const outputPath = join(outputDir, "gpt-image-2.png")
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
      prompt: "gpt-image-2 default test image",
      outputPath,
      model: "gpt-image-2",
      writeTxt: false,
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.errorMessage)
    expect(calls[0]?.body).toMatchObject({
      model: "gpt-image-2",
      size: "2048x1152",
      quality: "auto",
      background: "auto",
      output_format: "png",
    })
    expect(existsSync(outputPath)).toBe(true)
  })

  test("rejects gpt-image-2 options codex-lb cannot serve without issuing fetch", async () => {
    const cases: Array<{ name: string; options: Record<string, unknown>; message: string }> = [
      { name: "xhigh quality", options: { quality: "xhigh" }, message: "quality 'xhigh' is not supported" },
      { name: "max quality", options: { quality: "max" }, message: "quality 'max' is not supported" },
      { name: "gif output", options: { outputFormat: "gif" }, message: "outputFormat 'gif' is not supported" },
      { name: "svg output", options: { outputFormat: "svg" }, message: "outputFormat 'svg' is not supported" },
      {
        name: "transparent background",
        options: { background: "transparent" },
        message: "background 'transparent' is not supported",
      },
      { name: "complexity", options: { complexity: "low" }, message: "complexity is not supported" },
      { name: "frameCount", options: { frameCount: 9 }, message: "frameCount and frameDurationMs are not supported" },
      {
        name: "frameDurationMs",
        options: { frameDurationMs: 200 },
        message: "frameCount and frameDurationMs are not supported",
      },
      {
        name: "safetyIdentifier",
        options: { safetyIdentifier: "hashed-user-123" },
        message: "safetyIdentifier is not supported",
      },
    ]
    for (const { name, options, message } of cases) {
      let fetchCalls = 0
      const result = await codexImageGenerate({
        client: {
          baseUrl: "https://codex.example.test/v1/",
          apiKey: "test-token",
          requestTimeoutMs: 1_000,
          fetch: async () => {
            fetchCalls += 1
            return new Response("{}", { status: 200, statusText: "OK" })
          },
        },
        prompt: `gpt-image-2 gate: ${name}`,
        outputPath: join(outputDir, "gated.png"),
        model: "gpt-image-2",
        ...options,
      } as Parameters<typeof codexImageGenerate>[0])

      expect(result.success).toBe(false)
      if (result.success) throw new Error(`expected gpt-image-2 gate to fail for ${name}`)
      expect(result.errorMessage).toContain(message)
      expect(fetchCalls).toBe(0)
    }
  })
})
