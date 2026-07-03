import { createHash, randomBytes } from "node:crypto";

/**
 * Bitunix double SHA-256 request signing.
 *
 * digest = SHA256(nonce + timestamp + apiKey + sortedQueryParams + body)
 * sign   = SHA256(digest + secretKey)
 *
 * Query params are sorted by key (ASCII) and concatenated as key+value with
 * no separators. The body is the raw JSON string with no whitespace.
 * Matches the official reference implementation (BitunixOfficial/open-api).
 */

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export function sortQueryParams(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join("");
}

export function generateSignature(opts: {
  apiKey: string;
  secretKey: string;
  nonce: string;
  timestamp: string;
  queryParams?: string;
  body?: string;
}): string {
  const { apiKey, secretKey, nonce, timestamp, queryParams = "", body = "" } = opts;
  const digest = createHash("sha256")
    .update(nonce + timestamp + apiKey + queryParams + body)
    .digest("hex");
  return createHash("sha256").update(digest + secretKey).digest("hex");
}

export function buildAuthHeaders(opts: {
  apiKey: string;
  secretKey: string;
  queryParams?: Record<string, string>;
  body?: string;
}): Record<string, string> {
  const nonce = generateNonce();
  const timestamp = Date.now().toString();
  const sign = generateSignature({
    apiKey: opts.apiKey,
    secretKey: opts.secretKey,
    nonce,
    timestamp,
    queryParams: sortQueryParams(opts.queryParams ?? {}),
    body: opts.body ?? "",
  });
  return {
    "api-key": opts.apiKey,
    nonce,
    timestamp,
    sign,
  };
}
