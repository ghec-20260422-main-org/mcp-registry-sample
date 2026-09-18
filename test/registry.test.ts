import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/registry";

const baseUrl = "https://registry.example.test";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

function get(path: string) {
  return handleRequest({ method: "GET", url: `${baseUrl}${path}` });
}

function body<T>(response: ReturnType<typeof get>): T {
  expect(response.body).toBeDefined();
  return JSON.parse(response.body!) as T;
}

describe("service routes", () => {
  it("describes the API at the root", () => {
    const response = get("/");

    expect(response.status).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("application/json");
    expect(body(response)).toEqual({
      name: "MCP Registry",
      apiVersion: "v0.1",
      servers: `${baseUrl}/v0.1/servers`,
      health: `${baseUrl}/v0.1/health`
    });
  });

  it("provides a liveness endpoint", () => {
    const response = get("/v0.1/health");

    expect(response.status).toBe(200);
    expect(body(response)).toEqual({ status: "ok" });
  });
});

describe("registry HTTP contract", () => {
  it("returns JSON and all required CORS headers", () => {
    const response = get("/v0.1/servers");

    expect(response.status).toBe(200);
    expect(response.headers).toMatchObject({
      "Content-Type": "application/json",
      ...corsHeaders
    });
  });

  it("answers preflight requests without a body", () => {
    const response = handleRequest({
      method: "OPTIONS",
      url: `${baseUrl}/v0.1/servers/io.github.github%2Fgithub-mcp-server/versions/latest`
    });

    expect(response).toEqual({ status: 204, headers: corsHeaders });
  });

  it("returns a JSON 405 with CORS for unsupported registry operations", () => {
    const response = handleRequest({
      method: "POST",
      url: `${baseUrl}/v0.1/servers`
    });

    expect(response.status).toBe(405);
    expect(response.headers).toMatchObject({
      "Content-Type": "application/json",
      ...corsHeaders
    });
    expect(body(response)).toEqual({ error: "Method not allowed" });
  });

  it("does not require a trailing slash", () => {
    expect(get("/v0.1/servers").status).toBe(200);
    expect(get("/v0.1/servers/").status).toBe(200);
  });
});

describe("server listing", () => {
  it("returns the registered servers and metadata", () => {
    const response = get("/v0.1/servers");
    const result = body<{
      servers: Array<{ server: { name: string } }>;
      metadata: { count: number };
    }>(response);

    expect(result.metadata.count).toBe(2);
    expect(result.servers.map((entry) => entry.server.name)).toEqual([
      "com.postman/postman-mcp-server",
      "io.github.github/github-mcp-server"
    ]);
  });

  it("filters by search and version", () => {
    const response = get(
      "/v0.1/servers?search=GITHUB&version=latest&include_deleted=false"
    );
    const result = body<{
      servers: Array<{ server: { name: string } }>;
      metadata: { count: number };
    }>(response);

    expect(result.metadata.count).toBe(1);
    expect(result.servers[0].server.name).toBe(
      "io.github.github/github-mcp-server"
    );
  });

  it("supports opaque cursor pagination", () => {
    const firstResponse = get("/v0.1/servers?limit=1");
    const first = body<{
      servers: unknown[];
      metadata: { count: number; nextCursor: string };
    }>(firstResponse);

    expect(first.metadata.count).toBe(1);
    expect(first.metadata.nextCursor).toBeTruthy();

    const secondResponse = get(
      `/v0.1/servers?limit=1&cursor=${first.metadata.nextCursor}`
    );
    const second = body<{
      servers: unknown[];
      metadata: { count: number; nextCursor?: string };
    }>(secondResponse);

    expect(second.metadata).toEqual({ count: 1 });
  });

  it("filters by updated_since", () => {
    const before = body<{ metadata: { count: number } }>(
      get("/v0.1/servers?updated_since=2026-09-16T00%3A00%3A00Z")
    );
    const after = body<{ metadata: { count: number } }>(
      get("/v0.1/servers?updated_since=2026-09-18T00%3A00%3A00Z")
    );

    expect(before.metadata.count).toBe(2);
    expect(after.metadata.count).toBe(0);
  });

  it.each([
    ["/v0.1/servers?limit=0", "limit must be a positive integer"],
    ["/v0.1/servers?limit=101", "limit must be between 1 and 100"],
    ["/v0.1/servers?cursor=not-a-cursor", "cursor is invalid"],
    [
      "/v0.1/servers?updated_since=not-a-date",
      "updated_since must be an RFC3339 timestamp"
    ],
    [
      "/v0.1/servers?updated_since=2026",
      "updated_since must be an RFC3339 timestamp"
    ],
    [
      "/v0.1/servers?include_deleted=yes",
      "include_deleted must be either true or false"
    ]
  ])("rejects invalid query input for %s", (path, message) => {
    const response = get(path);

    expect(response.status).toBe(400);
    expect(body(response)).toEqual({ error: message });
    expect(response.headers).toMatchObject(corsHeaders);
  });
});

describe("server versions", () => {
  const encodedName = "io.github.github%2Fgithub-mcp-server";

  it("lists every version for an encoded canonical ID", () => {
    const response = get(`/v0.1/servers/${encodedName}/versions`);
    const result = body<{
      servers: Array<{ server: { name: string; version: string } }>;
      metadata: { count: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(result.metadata.count).toBe(1);
    expect(result.servers[0].server).toMatchObject({
      name: "io.github.github/github-mcp-server",
      version: "1.0.0"
    });
  });

  it.each(["latest", "1.0.0"])("returns the %s version", (version) => {
    const response = get(
      `/v0.1/servers/${encodedName}/versions/${version}`
    );
    const result = body<{ server: { name: string; version: string } }>(
      response
    );

    expect(response.status).toBe(200);
    expect(result.server).toMatchObject({
      name: "io.github.github/github-mcp-server",
      version: "1.0.0"
    });
  });

  it("also accepts a decoded slash in the canonical ID", () => {
    const response = get(
      "/v0.1/servers/io.github.github/github-mcp-server/versions/latest"
    );

    expect(response.status).toBe(200);
  });

  it.each([
    [
      "/v0.1/servers/com.example%2Funknown/versions/latest",
      "Server not found"
    ],
    [
      `/v0.1/servers/${encodedName}/versions/9.9.9`,
      "Server version not found"
    ],
    ["/v0.1/servers/not-a-version-route", "Registry route not found"]
  ])("returns a JSON 404 for %s", (path, message) => {
    const response = get(path);

    expect(response.status).toBe(404);
    expect(response.headers).toMatchObject({
      "Content-Type": "application/json",
      ...corsHeaders
    });
    expect(body(response)).toEqual({ error: message });
  });
});
