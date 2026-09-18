import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext
} from "@azure/functions";
import { handleRequest } from "./registry";

async function registryHandler(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  return handleRequest({
    method: request.method,
    url: request.url
  });
}

app.http("registry-root", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "",
  handler: registryHandler
});

app.http("registry-health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v0.1/health",
  handler: registryHandler
});

app.http("registry-servers", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "v0.1/servers",
  handler: registryHandler
});

app.http("registry-server-versions", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "v0.1/servers/{*path}",
  handler: registryHandler
});
