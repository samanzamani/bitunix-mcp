import { buildAuthHeaders } from "./sign.js";
import type { Config } from "./config.js";

/**
 * Hardened HTTP client for the Bitunix REST APIs.
 *
 * - Base URLs are pinned constants; no URL component ever comes from tool input
 *   except validated query/body values.
 * - Every request has a hard timeout and a response size cap.
 * - API credentials are redacted from any error text before it can reach the
 *   MCP client.
 */

export const FUTURES_BASE_URL = "https://fapi.bitunix.com";
export const SPOT_BASE_URL = "https://openapi.bitunix.com";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 5_000_000;

export type QueryParams = Record<string, string>;

interface BitunixEnvelope {
  code: number;
  msg?: string;
  message?: string;
  data?: unknown;
}

export class BitunixClient {
  constructor(private readonly config: Config) {}

  private redact(text: string): string {
    let out = text;
    if (this.config.apiKey) out = out.split(this.config.apiKey).join("[REDACTED]");
    if (this.config.secretKey) out = out.split(this.config.secretKey).join("[REDACTED]");
    return out;
  }

  private requireCredentials(): { apiKey: string; secretKey: string } {
    if (!this.config.apiKey || !this.config.secretKey) {
      throw new Error(
        "This tool requires API credentials. Set BITUNIX_API_KEY and BITUNIX_SECRET_KEY in the server environment."
      );
    }
    return { apiKey: this.config.apiKey, secretKey: this.config.secretKey };
  }

  async publicGet(baseUrl: string, path: string, params: QueryParams = {}): Promise<unknown> {
    return this.request({ baseUrl, path, method: "GET", params, signed: false });
  }

  async privateGet(baseUrl: string, path: string, params: QueryParams = {}): Promise<unknown> {
    return this.request({ baseUrl, path, method: "GET", params, signed: true });
  }

  async privatePost(baseUrl: string, path: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request({ baseUrl, path, method: "POST", body, signed: true });
  }

  private async request(opts: {
    baseUrl: string;
    path: string;
    method: "GET" | "POST";
    params?: QueryParams;
    body?: Record<string, unknown>;
    signed: boolean;
  }): Promise<unknown> {
    const url = new URL(opts.path, opts.baseUrl);
    const params = opts.params ?? {};
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      language: "en-US",
    };

    let bodyText: string | undefined;
    if (opts.method === "POST" && opts.body) {
      bodyText = JSON.stringify(opts.body);
    }

    if (opts.signed) {
      const { apiKey, secretKey } = this.requireCredentials();
      const authHeaders =
        opts.method === "POST"
          ? buildAuthHeaders({ apiKey, secretKey, body: bodyText ?? "" })
          : buildAuthHeaders({ apiKey, secretKey, queryParams: params });
      Object.assign(headers, authHeaders);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: opts.method,
        headers,
        body: bodyText ?? null,
        signal: controller.signal,
        redirect: "error",
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(this.redact(`Request to Bitunix failed: ${reason}`));
    } finally {
      clearTimeout(timer);
    }

    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_RESPONSE_BYTES) {
      throw new Error("Response exceeds size limit.");
    }

    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new Error("Response exceeds size limit.");
    }

    if (!response.ok) {
      throw new Error(this.redact(`Bitunix HTTP ${response.status}: ${text.slice(0, 500)}`));
    }

    let parsed: BitunixEnvelope;
    try {
      parsed = JSON.parse(text) as BitunixEnvelope;
    } catch {
      throw new Error(this.redact(`Bitunix returned non-JSON response: ${text.slice(0, 200)}`));
    }

    if (typeof parsed.code === "number" && parsed.code !== 0) {
      const msg = parsed.msg ?? parsed.message ?? "unknown error";
      throw new Error(this.redact(`Bitunix error ${parsed.code}: ${msg}`));
    }

    return parsed.data ?? parsed;
  }
}
