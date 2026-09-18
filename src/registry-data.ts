import type { ServerResponse } from "./types";

const schema =
  "https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json";

export const registryEntries: readonly ServerResponse[] = [
  {
    server: {
      $schema: schema,
      name: "io.github.github/github-mcp-server",
      description:
        "Connect AI assistants to GitHub repositories, issues, pull requests, and workflows.",
      title: "GitHub MCP Server",
      version: "1.0.0",
      repository: {
        url: "https://github.com/github/github-mcp-server",
        source: "github"
      },
      remotes: [
        {
          type: "streamable-http",
          url: "https://api.githubcopilot.com/mcp/"
        }
      ]
    },
    _meta: {
      "io.modelcontextprotocol.registry/official": {
        status: "active",
        publishedAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
        isLatest: true
      }
    }
  },
  {
    server: {
      $schema: schema,
      name: "com.postman/postman-mcp-server",
      description: "Operate on the Postman API through a remote MCP server.",
      title: "Postman MCP Server",
      version: "1.0.0",
      repository: {
        url: "https://github.com/postmanlabs/postman-mcp-server",
        source: "github"
      },
      remotes: [
        {
          type: "streamable-http",
          url: "https://mcp.postman.com/minimal",
          headers: [
            {
              description:
                "A valid Postman API key or OAuth bearer token for authentication.",
              isRequired: true,
              isSecret: true,
              name: "Authorization"
            }
          ]
        }
      ]
    },
    _meta: {
      "io.modelcontextprotocol.registry/official": {
        status: "active",
        publishedAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
        isLatest: true
      }
    }
  }
] as const;
