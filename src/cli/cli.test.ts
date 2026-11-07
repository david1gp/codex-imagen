import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import packageJson from "../../package.json" with { type: "json" }

const cliPath = resolve(import.meta.dir, "..", "cli.ts")
const pngBytes = Buffer.from("89504e470d0a1a0a", "hex")
const packageVersion = (packageJson as { version: string }).version

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
  if (childEnvironment.XDG_CONFIG_HOME === undefined) {
    childEnvironment.XDG_CONFIG_HOME = join(cwd, ".test-config")
  }

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
  test("exposes generate, edit, and version routes", async () => {
    await withTemporaryDirectory(async (directory) => {
      const result = await runCli(["--help"], directory)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("generate")
      expect(result.stdout).toContain("edit")
      expect(result.stdout).toContain("version")
      expect(result.stdout).not.toContain("grid")
    })
  })

  test("keeps plain version output free of credentials and network access", async () => {
    await withTemporaryDirectory(async (directory) => {
      const result = await runCli(["version"], directory)

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe("")
      expect(result.stdout).toBe(`codex-imagen v${packageVersion}\n`)
    })
  })

  test("prints package and runtime metadata in verbose version output", async () => {
    await withTemporaryDirectory(async (directory) => {
      const result = await runCli(["version", "--verbose"], directory)

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe("")
      expect(result.stdout).toContain(`codex-imagen v${packageVersion}\n`)
      expect(result.stdout).toContain("description: Type-safe codex-lb/OpenAI-compatible image generation helpers")
      expect(result.stdout).toContain("author: unavailable")
      expect(result.stdout).toContain("license: MIT")
      expect(result.stdout).toContain("project: https://github.com/david1gp/codex-imagen")
      expect(result.stdout).toContain("installation type: development checkout")
      expect(result.stdout).toContain(`runtime: bun ${Bun.version}`)
      expect(result.stdout).toContain("runtime requirements: unavailable")
      expect(result.stdout).toContain(`platform: ${process.platform} ${process.arch} (OS release `)
      expect(result.stdout).toMatch(/executable: .+\nexecutable target: .+\n/)
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
              "gpt-image-2.6-sunburst",
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
            model: "gpt-image-2.6-sunburst",
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
          expect(form.get("model")).toBe("gpt-image-2.6-sunburst")
          expect(form.get("prompt")).toBe("Remove the clouds")
          expect(form.get("n")).toBe("1")
          expect(form.get("size")).toBe("1536x1024")
          expect(form.get("quality")).toBe("low")
          expect(form.get("background")).toBe("opaque")
          expect(form.get("output_format")).toBe("jpeg")
          expect(form.get("output_compression")).toBe("42")
          expect(form.get("moderation")).toBe("low")
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

  test("maps generate complexity and GIF frame flags", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestBody: unknown

      await withMockProvider(
        async (request) => {
          requestBody = await request.json()
          return imageResponse()
        },
        async (baseUrl) => {
          const outputPath = join(directory, "animation.gif")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "A monkey lifts a glowing lantern",
              "--output-path",
              outputPath,
              "--model",
              "gpt-image-2.6-flare",
              "--size",
              "auto",
              "--output-format",
              "gif",
              "--complexity",
              "low",
              "--frame-count",
              "9",
              "--frame-duration-ms",
              "200",
              "--write-txt=false",
            ],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl, CODEX_IMAGE_API_KEY: "test-token" },
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestBody).toEqual({
            model: "gpt-image-2.6-flare",
            prompt: "A monkey lifts a glowing lantern",
            n: 1,
            size: "auto",
            quality: "auto",
            background: "auto",
            output_format: "gif",
            moderation: "auto",
            complexity: "low",
            frame_count: 9,
            frame_duration_ms: 200,
          })
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("maps edit markup and complexity flags", async () => {
    await withTemporaryDirectory(async (directory) => {
      const inputPath = join(directory, "input.webp")
      const markupPath = join(directory, "markup.png")
      const outputPath = join(directory, "edited.png")
      const inputBytes = Buffer.from("input-image")
      const markupBytes = Buffer.from("markup-image")
      writeFileSync(inputPath, inputBytes)
      writeFileSync(markupPath, markupBytes)

      let form: FormData | undefined

      await withMockProvider(
        async (request) => {
          form = await request.formData()
          return imageResponse()
        },
        async (baseUrl) => {
          const result = await runCli(
            [
              "edit",
              "--input-image-path",
              inputPath,
              "--prompt",
              "Recolor the circled vase",
              "--output-path",
              outputPath,
              "--markup-path",
              markupPath,
              "--model",
              "gpt-image-2.6-flare",
              "--complexity",
              "medium",
              "--write-txt=false",
            ],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl, CODEX_IMAGE_API_KEY: "test-token" },
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(form).toBeDefined()
          if (!form) throw new Error("mock provider did not receive a form")
          expect(form.get("model")).toBe("gpt-image-2.6-flare")
          expect(form.get("complexity")).toBe("medium")
          expect(form.get("mask")).toBeNull()

          const markup = form.get("markup")
          expect(markup).toBeInstanceOf(File)
          if (!(markup instanceof File)) throw new Error("mock provider did not receive markup")
          expect(markup.name).toBe("markup.png")
          expect(markup.type).toBe("image/png")
          expect(Buffer.from(await markup.arrayBuffer()).equals(markupBytes)).toBe(true)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("rejects edit requests combining mask and markup paths", async () => {
    await withTemporaryDirectory(async (directory) => {
      const inputPath = join(directory, "input.png")
      const maskPath = join(directory, "mask.png")
      const markupPath = join(directory, "markup.png")
      writeFileSync(inputPath, Buffer.from("input-image"))
      writeFileSync(maskPath, Buffer.from("mask-image"))
      writeFileSync(markupPath, Buffer.from("markup-image"))

      let requestCount = 0
      await withMockProvider(
        () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const result = await runCli(
            [
              "edit",
              "--input-image-path",
              inputPath,
              "--prompt",
              "Conflicting layers",
              "--output-path",
              join(directory, "conflict.png"),
              "--mask-path",
              maskPath,
              "--markup-path",
              markupPath,
            ],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl, CODEX_IMAGE_API_KEY: "test-token" },
          )

          expect(result.exitCode).toBe(1)
          expect(result.stdout).toBe("")
          expect(result.stderr).toContain("maskPath and markupPath are mutually exclusive")
          expect(requestCount).toBe(0)
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
        expect(authorization as string | null).toBe("Bearer environment-token")
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

  test("resolves generate credentials from an explicit config file", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestUrl = ""
      await withMockProvider(
        async (request) => {
          requestUrl = request.url
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(configPath, JSON.stringify({ baseUrl, apiKey: "config-token" }))
          const outputPath = join(directory, "config-only.png")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Config only",
              "--output-path",
              outputPath,
              "--config-path",
              configPath,
              "--write-txt=false",
            ],
            directory,
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestUrl).toBe(`${baseUrl}/images/generations`)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("resolves edit credentials from an explicit config file", async () => {
    await withTemporaryDirectory(async (directory) => {
      const inputPath = join(directory, "input.png")
      writeFileSync(inputPath, Buffer.from("input-image"))
      let requestUrl = ""
      await withMockProvider(
        async (request) => {
          requestUrl = request.url
          await request.formData()
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(configPath, JSON.stringify({ baseUrl, apiKey: "config-token" }))
          const outputPath = join(directory, "config-edit.png")
          const result = await runCli(
            [
              "edit",
              "--input-image-path",
              inputPath,
              "--prompt",
              "Config edit",
              "--output-path",
              outputPath,
              "--config-path",
              configPath,
              "--write-txt=false",
            ],
            directory,
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestUrl).toBe(`${baseUrl}/images/edits`)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("resolves the default config file from XDG_CONFIG_HOME", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const configHome = join(directory, "xdg-home")
          mkdirSync(join(configHome, "codex-imagen"), { recursive: true })
          writeFileSync(
            join(configHome, "codex-imagen", "codex-imagen.json"),
            JSON.stringify({ baseUrl, apiKey: "xdg-token" }),
          )
          const outputPath = join(directory, "xdg.png")
          const result = await runCli(
            ["generate", "--prompt", "XDG default", "--output-path", outputPath, "--write-txt=false"],
            directory,
            { XDG_CONFIG_HOME: configHome },
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestCount).toBe(1)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("resolves the API key from the variable named by config apiKeyEnv", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async (request) => {
          requestCount += 1
          if (request.headers.get("authorization") !== "Bearer named-token") {
            return new Response("unauthorized", { status: 401, statusText: "Unauthorized" })
          }
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(configPath, JSON.stringify({ baseUrl, apiKeyEnv: "CUSTOM_IMAGE_TOKEN" }))
          const outputPath = join(directory, "api-key-env.png")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Named variable",
              "--output-path",
              outputPath,
              "--config-path",
              configPath,
              "--write-txt=false",
            ],
            directory,
            { CUSTOM_IMAGE_TOKEN: "named-token" },
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestCount).toBe(1)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("prefers environment credentials over config file values", async () => {
    await withTemporaryDirectory(async (directory) => {
      let environmentRequestCount = 0
      let configRequestCount = 0
      const environmentServer = Bun.serve({
        port: 0,
        fetch: () => {
          environmentRequestCount += 1
          return imageResponse()
        },
      })
      const configServer = Bun.serve({
        port: 0,
        fetch: () => {
          configRequestCount += 1
          return imageResponse()
        },
      })

      try {
        const configPath = join(directory, "codex-imagen.json")
        writeFileSync(configPath, JSON.stringify({ baseUrl: configServer.url.origin, apiKey: "config-token" }))
        const outputPath = join(directory, "env-wins.png")
        const result = await runCli(
          [
            "generate",
            "--prompt",
            "Environment wins over config",
            "--output-path",
            outputPath,
            "--config-path",
            configPath,
            "--write-txt=false",
          ],
          directory,
          {
            CODEX_IMAGE_BASE_URL: environmentServer.url.origin,
            CODEX_IMAGE_API_KEY: "environment-token",
          },
        )

        expect(result.exitCode).toBe(0)
        expect(result.stdout).toBe(`${outputPath}\n`)
        expect(environmentRequestCount).toBe(1)
        expect(configRequestCount).toBe(0)
        expect(existsSync(outputPath)).toBe(true)
      } finally {
        await Promise.all([environmentServer.stop(true), configServer.stop(true)])
      }
    })
  })

  test("prefers CODEX_IMAGE_API_KEY over a failing config apiKeyEnv source", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(configPath, JSON.stringify({ baseUrl, apiKeyEnv: "DEFINITELY_MISSING_VARIABLE" }))
          const outputPath = join(directory, "direct-env-wins.png")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Direct env wins",
              "--output-path",
              outputPath,
              "--config-path",
              configPath,
              "--write-txt=false",
            ],
            directory,
            { CODEX_IMAGE_API_KEY: "environment-token" },
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(requestCount).toBe(1)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("prefers --base-url over the environment base URL", async () => {
    await withTemporaryDirectory(async (directory) => {
      let flagRequestCount = 0
      let environmentRequestCount = 0
      const flagServer = Bun.serve({
        port: 0,
        fetch: () => {
          flagRequestCount += 1
          return imageResponse()
        },
      })
      const environmentServer = Bun.serve({
        port: 0,
        fetch: () => {
          environmentRequestCount += 1
          return imageResponse()
        },
      })

      try {
        const outputPath = join(directory, "flag-wins.png")
        const result = await runCli(
          [
            "generate",
            "--prompt",
            "Flag wins",
            "--output-path",
            outputPath,
            "--base-url",
            flagServer.url.origin,
            "--write-txt=false",
          ],
          directory,
          {
            CODEX_IMAGE_BASE_URL: environmentServer.url.origin,
            CODEX_IMAGE_API_KEY: "environment-token",
          },
        )

        expect(result.exitCode).toBe(0)
        expect(result.stdout).toBe(`${outputPath}\n`)
        expect(flagRequestCount).toBe(1)
        expect(environmentRequestCount).toBe(0)
        expect(existsSync(outputPath)).toBe(true)
      } finally {
        await Promise.all([flagServer.stop(true), environmentServer.stop(true)])
      }
    })
  })

  test("resolves the API key from the variable named by --api-key-env", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(configPath, JSON.stringify({ apiKeyEnv: "DEFINITELY_MISSING_VARIABLE" }))
          const outputPath = join(directory, "flag-api-key-env.png")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Flag names the variable",
              "--output-path",
              outputPath,
              "--config-path",
              configPath,
              "--api-key-env",
              "FLAG_NAMED_TOKEN",
              "--write-txt=false",
            ],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl, FLAG_NAMED_TOKEN: "flag-named-token" },
          )

          expect(result.exitCode).toBe(0)
          expect(result.stderr).toBe("")
          expect(requestCount).toBe(1)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })

  test("fails when the variable named by --api-key-env is missing", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Missing named variable",
              "--output-path",
              join(directory, "missing-named.png"),
              "--api-key-env",
              "DEFINITELY_MISSING_VARIABLE",
              "--write-txt=false",
            ],
            directory,
            { CODEX_IMAGE_BASE_URL: baseUrl },
          )

          expect(result.exitCode).toBe(1)
          expect(result.stdout).toBe("")
          expect(result.stderr).toContain("DEFINITELY_MISSING_VARIABLE")
          expect(requestCount).toBe(0)
        },
      )
    })
  })

  test("fails closed when the config apiKeyEnv variable is missing despite config apiKey", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(
            configPath,
            JSON.stringify({ baseUrl, apiKeyEnv: "DEFINITELY_MISSING_VARIABLE", apiKey: "fallback-token" }),
          )
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Fail closed",
              "--output-path",
              join(directory, "fail-closed.png"),
              "--config-path",
              configPath,
              "--write-txt=false",
            ],
            directory,
          )

          expect(result.exitCode).toBe(1)
          expect(result.stdout).toBe("")
          expect(result.stderr).toContain("DEFINITELY_MISSING_VARIABLE")
          expect(requestCount).toBe(0)
        },
      )
    })
  })

  test("fails with an explicit missing config file", async () => {
    await withTemporaryDirectory(async (directory) => {
      const missingConfigPath = join(directory, "does-not-exist.json")
      const result = await runCli(
        [
          "generate",
          "--config-path",
          missingConfigPath,
          "--prompt",
          "Missing config",
          "--output-path",
          join(directory, "missing-config.png"),
        ],
        directory,
        {
          CODEX_IMAGE_BASE_URL: "http://127.0.0.1:1",
          CODEX_IMAGE_API_KEY: "test-token",
        },
      )

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("cliConfigLoad")
      expect(result.stderr).toContain(missingConfigPath)
    })
  })

  test("fails with an invalid JSON config file", async () => {
    await withTemporaryDirectory(async (directory) => {
      const configPath = join(directory, "codex-imagen.json")
      writeFileSync(configPath, "{not valid json")
      const result = await runCli(
        [
          "generate",
          "--config-path",
          configPath,
          "--prompt",
          "Invalid JSON",
          "--output-path",
          join(directory, "invalid-json.png"),
        ],
        directory,
        {
          CODEX_IMAGE_BASE_URL: "http://127.0.0.1:1",
          CODEX_IMAGE_API_KEY: "test-token",
        },
      )

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("cliConfigLoad")
      expect(result.stderr).toContain(configPath)
    })
  })

  test("fails with a schema-invalid config file", async () => {
    await withTemporaryDirectory(async (directory) => {
      const configPath = join(directory, "codex-imagen.json")
      writeFileSync(configPath, JSON.stringify({ baseUrl: "", requestTimeoutMs: 0 }))
      const result = await runCli(
        [
          "generate",
          "--config-path",
          configPath,
          "--prompt",
          "Schema invalid",
          "--output-path",
          join(directory, "schema-invalid.png"),
        ],
        directory,
        {
          CODEX_IMAGE_BASE_URL: "http://127.0.0.1:1",
          CODEX_IMAGE_API_KEY: "test-token",
        },
      )

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("cliConfigLoad")
      expect(result.stderr).toContain(configPath)
    })
  })

  test("applies config requestTimeoutMs when --request-timeout-ms is absent", async () => {
    await withTemporaryDirectory(async (directory) => {
      const server = Bun.serve({
        port: 0,
        fetch: async () => {
          await Bun.sleep(5000)
          return imageResponse()
        },
      })
      try {
        const configPath = join(directory, "codex-imagen.json")
        writeFileSync(
          configPath,
          JSON.stringify({ baseUrl: server.url.origin, apiKey: "config-token", requestTimeoutMs: 50 }),
        )
        const result = await runCli(
          [
            "generate",
            "--prompt",
            "Config timeout",
            "--output-path",
            join(directory, "config-timeout.png"),
            "--config-path",
            configPath,
            "--write-txt=false",
          ],
          directory,
        )

        expect(result.exitCode).toBe(1)
        expect(result.stdout).toBe("")
        expect(result.stderr).toContain("timed out")
      } finally {
        await server.stop(true)
      }
    })
  })

  test("prefers --request-timeout-ms over config requestTimeoutMs", async () => {
    await withTemporaryDirectory(async (directory) => {
      let requestCount = 0
      await withMockProvider(
        async () => {
          requestCount += 1
          return imageResponse()
        },
        async (baseUrl) => {
          const configPath = join(directory, "codex-imagen.json")
          writeFileSync(configPath, JSON.stringify({ baseUrl, apiKey: "config-token", requestTimeoutMs: 1 }))
          const outputPath = join(directory, "flag-timeout.png")
          const result = await runCli(
            [
              "generate",
              "--prompt",
              "Flag timeout wins",
              "--output-path",
              outputPath,
              "--config-path",
              configPath,
              "--request-timeout-ms",
              "30000",
              "--write-txt=false",
            ],
            directory,
          )

          expect(result.exitCode).toBe(0)
          expect(result.stdout).toBe(`${outputPath}\n`)
          expect(requestCount).toBe(1)
          expect(existsSync(outputPath)).toBe(true)
        },
      )
    })
  })
})
