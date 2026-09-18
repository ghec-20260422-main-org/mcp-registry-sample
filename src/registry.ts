import { registryEntries } from "./registry-data";
import type {
  RequestData,
  ResponseData,
  ServerList,
  ServerResponse
} from "./types";

const registryCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

const jsonHeaders = {
  "Content-Type": "application/json"
};

const defaultLimit = 100;
const maximumLimit = 100;

function json(
  status: number,
  value: unknown,
  includeRegistryCors = false
): ResponseData {
  return {
    status,
    headers: {
      ...jsonHeaders,
      ...(includeRegistryCors ? registryCorsHeaders : {})
    },
    body: JSON.stringify(value)
  };
}

function error(status: number, message: string): ResponseData {
  return json(status, { error: message }, true);
}

function parseBoolean(value: string | null, name: string): boolean | ResponseData {
  if (value === null || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  return error(400, `${name} must be either true or false`);
}

function parseLimit(value: string | null): number | ResponseData {
  if (value === null) {
    return defaultLimit;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    return error(400, "limit must be a positive integer");
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > maximumLimit) {
    return error(400, `limit must be between 1 and ${maximumLimit}`);
  }
  return limit;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function parseCursor(value: string | null): number | ResponseData {
  if (value === null) {
    return 0;
  }

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (!/^(0|[1-9]\d*)$/.test(decoded) || encodeCursor(Number(decoded)) !== value) {
      return error(400, "cursor is invalid");
    }
    const offset = Number(decoded);
    return Number.isSafeInteger(offset) ? offset : error(400, "cursor is invalid");
  } catch {
    return error(400, "cursor is invalid");
  }
}

function decodePathComponent(value: string, label: string): string | ResponseData {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : error(400, `${label} must not be empty`);
  } catch {
    return error(400, `${label} is not valid URL encoding`);
  }
}

function isResponseData(value: unknown): value is ResponseData {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as ResponseData).status === "number"
  );
}

function activeEntries(includeDeleted: boolean): ServerResponse[] {
  return registryEntries.filter((entry) => {
    const metadata = entry._meta["io.modelcontextprotocol.registry/official"];
    return includeDeleted || metadata.status !== "deleted";
  });
}

function listServers(url: URL): ResponseData {
  const includeDeletedResult = parseBoolean(
    url.searchParams.get("include_deleted"),
    "include_deleted"
  );
  if (isResponseData(includeDeletedResult)) {
    return includeDeletedResult;
  }

  const limitResult = parseLimit(url.searchParams.get("limit"));
  if (isResponseData(limitResult)) {
    return limitResult;
  }

  const cursorResult = parseCursor(url.searchParams.get("cursor"));
  if (isResponseData(cursorResult)) {
    return cursorResult;
  }

  const updatedSinceValue = url.searchParams.get("updated_since");
  let updatedSince: number | undefined;
  if (updatedSinceValue !== null) {
    const rfc3339 =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
    updatedSince = Date.parse(updatedSinceValue);
    if (!rfc3339.test(updatedSinceValue) || Number.isNaN(updatedSince)) {
      return error(400, "updated_since must be an RFC3339 timestamp");
    }
  }

  const search = url.searchParams.get("search")?.toLowerCase();
  const version = url.searchParams.get("version");
  const includeDeleted = updatedSinceValue !== null || includeDeletedResult;

  let entries = activeEntries(includeDeleted)
    .filter(
      (entry) =>
        search === undefined ||
        entry.server.name.toLowerCase().includes(search)
    )
    .filter(
      (entry) =>
        version === null ||
        (version === "latest"
          ? entry._meta["io.modelcontextprotocol.registry/official"].isLatest
          : entry.server.version === version)
    )
    .filter(
      (entry) =>
        updatedSince === undefined ||
        Date.parse(
          entry._meta["io.modelcontextprotocol.registry/official"].updatedAt
        ) > updatedSince
    )
    .sort((left, right) =>
      left.server.name.localeCompare(right.server.name)
    );

  if (cursorResult > entries.length) {
    return error(400, "cursor is outside the result set");
  }

  const page = entries.slice(cursorResult, cursorResult + limitResult);
  const nextOffset = cursorResult + page.length;
  const response: ServerList = {
    servers: page,
    metadata: {
      count: page.length,
      ...(nextOffset < entries.length
        ? { nextCursor: encodeCursor(nextOffset) }
        : {})
    }
  };
  return json(200, response, true);
}

function parseServerRoute(pathname: string):
  | {
      serverName: string;
      version?: string;
    }
  | ResponseData {
  const prefix = "/v0.1/servers/";
  const suffix = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : "";
  const match = /^(.+)\/versions(?:\/([^/]+))?\/?$/.exec(suffix);
  if (match === null) {
    return error(404, "Registry route not found");
  }

  const serverName = decodePathComponent(match[1], "serverName");
  if (isResponseData(serverName)) {
    return serverName;
  }

  if (match[2] === undefined) {
    return { serverName };
  }

  const version = decodePathComponent(match[2], "version");
  return isResponseData(version) ? version : { serverName, version };
}

function getServer(url: URL): ResponseData {
  const route = parseServerRoute(url.pathname);
  if (isResponseData(route)) {
    return route;
  }

  const includeDeletedResult = parseBoolean(
    url.searchParams.get("include_deleted"),
    "include_deleted"
  );
  if (isResponseData(includeDeletedResult)) {
    return includeDeletedResult;
  }

  const entries = activeEntries(includeDeletedResult).filter(
    (entry) => entry.server.name === route.serverName
  );
  if (entries.length === 0) {
    return error(404, "Server not found");
  }

  if (route.version === undefined) {
    const response: ServerList = {
      servers: entries,
      metadata: { count: entries.length }
    };
    return json(200, response, true);
  }

  const entry =
    route.version === "latest"
      ? entries.find(
          (candidate) =>
            candidate._meta["io.modelcontextprotocol.registry/official"].isLatest
        )
      : entries.find((candidate) => candidate.server.version === route.version);
  return entry === undefined
    ? error(404, "Server version not found")
    : json(200, entry, true);
}

export function handleRequest(request: RequestData): ResponseData {
  const url = new URL(request.url);
  const pathname =
    url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const isRegistryRoute = pathname.startsWith("/v0.1/servers");

  if (request.method === "OPTIONS" && isRegistryRoute) {
    return {
      status: 204,
      headers: registryCorsHeaders
    };
  }

  if (request.method !== "GET") {
    return json(405, { error: "Method not allowed" }, isRegistryRoute);
  }

  if (pathname === "/") {
    return json(200, {
      name: "MCP Registry",
      apiVersion: "v0.1",
      servers: `${url.origin}/v0.1/servers`,
      health: `${url.origin}/v0.1/health`
    });
  }

  if (pathname === "/v0.1/health") {
    return json(200, { status: "ok" });
  }

  if (pathname === "/v0.1/servers") {
    return listServers(url);
  }

  if (pathname.startsWith("/v0.1/servers/")) {
    return getServer(new URL(`${url.origin}${pathname}${url.search}`));
  }

  return json(404, { error: "Route not found" });
}
