export interface RegistryInput {
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  name: string;
}

export interface RemoteTransport {
  type: "streamable-http" | "sse";
  url: string;
  headers?: RegistryInput[];
}

export interface ServerDetail {
  $schema: string;
  name: string;
  description: string;
  title?: string;
  version: string;
  repository?: {
    url: string;
    source: string;
  };
  remotes?: RemoteTransport[];
}

export type RegistryStatus = "active" | "deprecated" | "deleted";

export interface RegistryMetadata {
  status: RegistryStatus;
  statusMessage?: string;
  publishedAt: string;
  updatedAt: string;
  isLatest: boolean;
}

export interface ServerResponse {
  server: ServerDetail;
  _meta: {
    "io.modelcontextprotocol.registry/official": RegistryMetadata;
  };
}

export interface ServerList {
  servers: ServerResponse[];
  metadata: {
    count: number;
    nextCursor?: string;
  };
}

export interface RequestData {
  method: string;
  url: string;
}

export interface ResponseData {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}
