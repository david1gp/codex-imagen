import { existsSync, realpathSync } from "node:fs"
import { release as osRelease } from "node:os"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { CommandContext } from "@stricli/core"
import packageJson from "../../package.json" with { type: "json" }

type PackageMetadata = {
  name: string
  version: string
  description?: string
  author?: string | { name?: string; url?: string }
  license?: string
  homepage?: string
  repository?: { url?: string }
  bin?: Record<string, string>
  engines?: Record<string, string>
}

const packageMetadata = packageJson as PackageMetadata

function cliNameResolve(): string {
  const [name] = Object.keys(packageMetadata.bin ?? {})
  return name ?? packageMetadata.name
}

function cliExecutableResolve(): { entrypoint: string; target?: string } {
  const entrypoint = process.argv[1]
  if (entrypoint === undefined) return { entrypoint: "unavailable" }

  const resolvedEntrypoint = resolve(entrypoint)
  try {
    return { entrypoint: resolvedEntrypoint, target: realpathSync(resolvedEntrypoint) }
  } catch {
    return { entrypoint: resolvedEntrypoint }
  }
}

function cliInstallationTypeResolve(executableTarget: string | undefined): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  if (existsSync(resolve(packageRoot, ".git"))) return "development checkout"
  if (executableTarget !== undefined && !relative(packageRoot, executableTarget).startsWith(".."))
    return "package installation"
  return "unknown"
}

function cliAuthorRender(): string {
  if (typeof packageMetadata.author === "string") return packageMetadata.author
  return [packageMetadata.author?.name, packageMetadata.author?.url].filter(Boolean).join(" — ") || "unavailable"
}

function cliRuntimeResolve(): string {
  return typeof Bun === "undefined" ? `${process.release.name} ${process.version}` : `bun ${Bun.version}`
}

function cliRuntimeRequirementsRender(): string {
  return (
    Object.entries(packageMetadata.engines ?? {})
      .map(([runtime, requirement]) => `${runtime} ${requirement}`)
      .join(", ") || "unavailable"
  )
}

export function cliVersionPresent(verbose: boolean, output: CommandContext["process"]): void {
  const lines = [`${cliNameResolve()} v${packageMetadata.version}`]
  if (verbose) {
    const executable = cliExecutableResolve()
    lines.push(`executable: ${executable.entrypoint}`)
    lines.push(`executable target: ${executable.target ?? "unavailable"}`)
    lines.push(`version: ${packageMetadata.version}`)
    lines.push(`description: ${packageMetadata.description ?? "unavailable"}`)
    lines.push(`author: ${cliAuthorRender()}`)
    lines.push(`license: ${packageMetadata.license ?? "unavailable"}`)
    lines.push(`project: ${packageMetadata.homepage ?? packageMetadata.repository?.url ?? "unavailable"}`)
    lines.push(`installation type: ${cliInstallationTypeResolve(executable.target)}`)
    lines.push(`runtime: ${cliRuntimeResolve()}`)
    lines.push(`runtime requirements: ${cliRuntimeRequirementsRender()}`)
    lines.push(`platform: ${process.platform} ${process.arch} (OS release ${osRelease()})`)
  }
  output.stdout.write(`${lines.join("\n")}\n`)
}
