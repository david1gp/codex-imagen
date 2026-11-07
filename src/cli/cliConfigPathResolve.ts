import { homedir } from "node:os"
import { join } from "node:path"

export function cliConfigPathResolve(
  explicitPath: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  if (explicitPath !== undefined) return explicitPath
  const configHome = environment.XDG_CONFIG_HOME
  const baseDirectory =
    configHome !== undefined && configHome.trim().length > 0
      ? configHome
      : join(environment.HOME ?? homedir(), ".config")
  return join(baseDirectory, "codex-imagen", "codex-imagen.json")
}
