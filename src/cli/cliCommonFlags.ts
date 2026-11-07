export const cliCommonFlags = {
  dotenvPath: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Load environment variables from this dotenv file",
  },
  requestTimeoutMs: {
    kind: "parsed" as const,
    parse: Number,
    optional: true as const,
    brief: "Request timeout in milliseconds",
  },
  configPath: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Load configuration from this JSON config file",
  },
  baseUrl: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Image API base URL",
  },
  apiKeyEnv: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Name of the environment variable holding the API key",
  },
}

export type CliCommonFlags = {
  dotenvPath?: string
  requestTimeoutMs?: number
  configPath?: string
  baseUrl?: string
  apiKeyEnv?: string
}
