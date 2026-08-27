import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const cliPath = resolve(import.meta.dir, "..", "cli.ts")
const pngBytes = Buffer.from("89504e470d0a1a0a", "hex")

type CliResult = {
  stdout: string
  stderr: string
  exitCode: number
}

async function runCli(
  args: readonly string[],
  cwd: string,
  environment: Readonly<Record<string, string | undefined>> = {},
): Promise<CliResult> {
  const childEnvironment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) childEnvironment[key] = value
  }
  delete childEnvironment.CODEX_IMAGE_BASE_URL
  delete childEnvironment.CODEX_IMAGE_API_KEY
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete childEnvironment[key]
    } else {
      childEnvironment[key] = value
    }
  }
  childEnvironment.STRICLI_NO_COLOR = "1"

  const child = Bun.spawn([process.execPath, "run", cliPath, ...args], {
    cwd,
    env: childEnvironment,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = new Response(child.stdout).text()
  const stderr = new Response(child.stderr).text()
  const [output, error, exitCode] = await Promise.all([stdout, stderr, child.exited])
  return { stdout: output, stderr: error, exitCode }
}

async function withTemporaryDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
  const directory = mkdtempSync(join(tmpdir(), "codex-imagen-cli-test-"))
  try {
    return await callback(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

async function withMockProvider<T>(
  handler: (request: Request) => Response | Promise<Response>,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = Bun.serve({ port: 0, fetch: handler })
  try {
    return await callback(server.url.origin)
  } finally {
    await server.stop(true)
  }
}

function imageResponse(): Response {
  return new Response(
    JSON.stringify({
      created: 1,
      data: [{ b64_json: pngBytes.toString("base64"), revised_prompt: "revised" }],
    }),
    { headers: { "Content-Type": "application/json" } },
  )
}

describe("codex-imagen CLI", () => {
  test("exposes only generate and edit routes", async () => {
    await withTemporaryDirectory(async (directory) => {
      const result = await runCli(["--help"], directory)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("generate")
      expect(result.stdout).toContain("edit")
      expect(result.stdout).not.toContain("grid")
    })
  })

  test("maps generate flags, loads the default dotenv file, and prints the output path", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestUrl = ""
      let authorization: string | null = null
      let requestBody: unknown

      await withMockProvider(
        async (request) => {
          requestUrl = request.url
          authorization = request.headers.get("authorization")
          requestBody = await request.json()
          return imageResponse()
        },
        async (baseUrl) => {
          writeFileSync(join(directory, ".env"), `CODEX_IMAGE_BASE_URL=${baseUrl}\nCODEX_IMAGE_API_KEY=dotenv-token\n`)
          const outputPath = join(directory, "generated.png")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "A lighthouse at dawn",
              "--output-path",
              outputPath,
              "--model",
              "gpt-image-2",
              "--size",
              "1024x1024",
              "--quality",
              "high",
              "--background",
              "opaque",
              "--output-format",
              "png",
              "--output-compression",
              "73",
              "--moderation",
              "low",
              "--user",
              "generate-user",
              "--request-timeout-ms",
              "10000",
              "--write-txt=false",
            ],
            directory,
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestUrl).toBe(`${baseUrl}/images/generations`)
          expect(authorization).toBe("Bearer dotenv-token")
          expect(requestBody).toEqual({
            model: "gpt-image-2",
            prompt: "A lighthouse at dawn",
            n: 1,
            size: "1024x1024",
            quality: "high",
            background: "opaque",
            output_format: "png",
            output_compression: 73,
            moderation: "low",
            user: "generate-user",
          })
          expect(existsSync(outputPath)).toBe(true)
          expect(readFileSync(outputPath).equals(pngBytes)).toBe(true)
          expect(existsSync(outputPath.replace(/\.[^.]*$/, ".txt"))).toBe(false)
        },
      )
    })
  })

  test("maps edit flags and loads credentials from an explicit dotenv path", async () => {
    await withTemporaryDirectory(async (directory) => {
      const inputPath = join(directory, "input.jpg")
      const maskPath = join(directory, "mask.png")
      const outputPath = join(directory, "edited.png")
      const inputBytes = Buffer.from("input-image")
      const maskBytes = Buffer.from("mask-image")
      writeFileSync(inputPath, inputBytes)
      writeFileSync(maskPath, maskBytes)

      let requestUrl = ""
      let authorization: string | null = null
      let form: FormData | undefined

      await withMockProvider(
        async (request) => {
          requestUrl = request.url
          authorization = request.headers.get("authorization")
          form = await request.formData()
          return imageResponse()
        },
        async (baseUrl) => {
          const dotenvPath = join(directory, "credentials.env")
          writeFileSync(dotenvPath, `CODEX_IMAGE_BASE_URL=${baseUrl}\nCODEX_IMAGE_API_KEY=explicit-token\n`)
          const result = await runCli(
            [
              "edit",
              "--input-image-path",
              inputPath,
              "--prompt",
              "Remove the clouds",
              "--output-path",
              outputPath,
              "--mask-path",
              maskPath,
              "--model",
              "gpt-image-1",
              "--size",
              "1536x1024",
              "--quality",
              "low",
              "--background",
              "opaque",
              "--output-format",
              "jpeg",
              "--output-compression",
              "42",
              "--moderation",
              "low",
              "--input-fidelity",
              "high",
              "--user",
              "edit-user",
              "--dotenv-path",
              dotenvPath,
              "--write-txt=false",
            ],
            directory,
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestUrl).toBe(`${baseUrl}/images/edits`)
          expect(authorization).toBe("Bearer explicit-token")
          expect(form).toBeDefined()
          if (!form) throw new Error("mock provider did not receive a form")
          expect(form.get("model")).toBe("gpt-image-1")
          expect(form.get("prompt")).toBe("Remove the clouds")
          expect(form.get("n")).toBe("1")
          expect(form.get("size")).toBe("1536x1024")
          expect(form.get("quality")).toBe("low")
          expect(form.get("background")).toBe("opaque")
          expect(form.get("output_format")).toBe("jpeg")
          expect(form.get("output_compression")).toBe("42")
          expect(form.get("moderation")).toBe("low")
          expect(form.get("input_fidelity")).toBe("high")
          expect(form.get("user")).toBe("edit-user")

          const image = form.get("image[]")
          const mask = form.get("mask")
          expect(image).toBeInstanceOf(File)
          expect(mask).toBeInstanceOf(File)
          if (!(image instanceof File) || !(mask instanceof File))
            throw new Error("mock provider did not receive files")
          expect(image.name).toBe("input.jpg")
          expect(image.type).toBe("image/jpeg")
          expect(Buffer.from(await image.arrayBuffer()).equals(inputBytes)).toBe(true)
          expect(mask.name).toBe("mask.png")
          expect(mask.type).toBe("image/png")
          expect(Buffer.from(await mask.arrayBuffer()).equals(maskBytes)).toBe(true)
          expect(existsSync(outputPath)).toBe(true)
          expect(readFileSync(outputPath).equals(pngBytes)).toBe(true)
        },
      )
    })
  })

  test("prefers environment credentials over the default dotenv file", async () => {
    await withTemporaryDirectory(async (directory) => {
      let environmentRequestCount = 0
      let dotenvRequestCount = 0
      let authorization: string | null = null
      const environmentServer = Bun.serve({
        port: 0,
        fetch: (request) => {
          environmentRequestCount += 1
          authorization = request.headers.get("authorization")
          return imageResponse()
        },
      })
      const dotenvServer = Bun.serve({
        port: 0,
        fetch: () => {
          dotenvRequestCount += 1
          return imageResponse()
        },
      })

      try {
        writeFileSync(
          join(directory, ".env"),
          `CODEX_IMAGE_BASE_URL=${dotenvServer.url.origin}\nCODEX_IMAGE_API_KEY=dotenv-token\n`,
        )
        const outputPath = join(directory, "precedence.png")
        const result = await runCli(
          ["generate", "--prompt", "Environment wins", "--output-path", outputPath, "--write-txt=false"],
          directory,
          {
            CODEX_IMAGE_BASE_URL: environmentServer.url.origin,
            CODEX_IMAGE_API_KEY: "environment-token",
          },
        )

        expect(result.exitCode).toBe(0)
        expect(result.stdout).toBe(`${outputPath}\n`)
        expect(environmentRequestCount).toBe(1)
        expect(dotenvRequestCount).toBe(0)
        expect(authorization).toBe("Bearer environment-token")
        expect(existsSync(outputPath)).toBe(true)
      } finally {
        await Promise.all([environmentServer.stop(true), dotenvServer.stop(true)])
      }
    })
  })

  test("fails with missing credentials", async () => {
    await withTemporaryDirectory(async (directory) => {
      const outputPath = join(directory, "missing-credentials.png")
      const missingBaseUrl = await runCli(
        ["generate", "--prompt", "Missing base URL", "--output-path", outputPath],
        directory,
      )
      expect(missingBaseUrl.exitCode).toBe(1)
      expect(missingBaseUrl.stdout).toBe("")
      expect(missingBaseUrl.stderr).toContain("CODEX_IMAGE_BASE_URL is required")

      let requestCount = 0
      const server = Bun.serve({
        port: 0,
        fetch: () => {
          requestCount += 1
          return imageResponse()
        },
      })
      try {
        const missingApiKey = await runCli(
          ["generate", "--prompt", "Missing API key", "--output-path", outputPath],
          directory,
          { CODEX_IMAGE_BASE_URL: server.url.origin },
        )
        expect(missingApiKey.exitCode).toBe(1)
        expect(missingApiKey.stdout).toBe("")
        expect(missingApiKey.stderr).toContain("CODEX_IMAGE_API_KEY is required")
        expect(requestCount).toBe(0)
      } finally {
        await server.stop(true)
      }
    })
  })

  test("fails with an explicit dotenv loading error", async () => {
    await withTemporaryDirectory(async (directory) => {
      const missingDotenvPath = join(directory, "does-not-exist.env")
      const result = await runCli(
        [
          "generate",
          "--dotenv-path",
          missingDotenvPath,
          "--prompt",
          "Missing dotenv",
          "--output-path",
          join(directory, "missing-dotenv.png"),
        ],
        directory,
        {
          CODEX_IMAGE_BASE_URL: "http://127.0.0.1:1",
          CODEX_IMAGE_API_KEY: "test-token",
        },
      )

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("cliDotenvLoad")
      expect(result.stderr).toContain(missingDotenvPath)
    })
  })

  test("returns a nonzero exit code for an API failure", async () => {
    await withTemporaryDirectory(async (directory) => {
      await withMockProvider(
        () =>
          new Response(JSON.stringify({ success: false, op: "provider", errorMessage: "quota exceeded" }), {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Content-Type": "application/json" },
          }),
        async (baseUrl) => {
          const result = await runCli(
            ["generate", "--prompt", "Provider failure", "--output-path", join(directory, "api-failure.png")],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl, CODEX_IMAGE_API_KEY: "test-token" },
          )

          expect(result.exitCode).toBe(1)
          expect(result.stdout).toBe("")
          expect(result.stderr).toContain("quota exceeded")
        },
      )
    })
  })

  test("returns a nonzero exit code for a library result failure", async () => {
    await withTemporaryDirectory(async (directory) => {
      const inputPath = join(directory, "input.png")
      writeFileSync(inputPath, Buffer.from("input-image"))
      await withMockProvider(
        () =>
          new Response(JSON.stringify({ created: 1, data: [{}] }), {
            headers: { "Content-Type": "application/json" },
          }),
        async (baseUrl) => {
          const outputPath = join(directory, "library-failure.png")
          const result = await runCli(
            ["edit", "--input-image-path", inputPath, "--prompt", "Library failure", "--output-path", outputPath],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl, CODEX_IMAGE_API_KEY: "test-token" },
          )

          expect(result.exitCode).toBe(1)
          expect(result.stdout).toBe("")
          expect(result.stderr).toContain("codexImageResultWrite")
          expect(existsSync(outputPath)).toBe(false)
        },
      )
    })
  })
})
