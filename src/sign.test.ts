import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateNonce, generateSignature, sortQueryParams } from "./sign.js";
import { loadConfig } from "./config.js";

test("nonce is 32 hex chars and unique", () => {
  const a = generateNonce();
  const b = generateNonce();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("query params are sorted by key and concatenated without separators", () => {
  assert.equal(sortQueryParams({ id: "1", uid: "200" }), "id1uid200");
  assert.equal(sortQueryParams({ uid: "200", id: "1" }), "id1uid200");
  assert.equal(sortQueryParams({}), "");
});

test("signature matches the documented double SHA-256 scheme", () => {
  const apiKey = "testApiKey";
  const secretKey = "testSecretKey";
  const nonce = "123456";
  const timestamp = "20241120123045";
  const queryParams = "id1uid200";
  const body = '{"uid":"2899"}';

  const digest = createHash("sha256")
    .update(nonce + timestamp + apiKey + queryParams + body)
    .digest("hex");
  const expected = createHash("sha256").update(digest + secretKey).digest("hex");

  const actual = generateSignature({ apiKey, secretKey, nonce, timestamp, queryParams, body });
  assert.equal(actual, expected);
});

test("config rejects half-configured credentials", () => {
  assert.throws(() => loadConfig({ BITUNIX_API_KEY: "abcdef1234567890" } as NodeJS.ProcessEnv));
  assert.throws(() => loadConfig({ BITUNIX_SECRET_KEY: "abcdef1234567890" } as NodeJS.ProcessEnv));
});

test("config rejects trading without credentials", () => {
  assert.throws(() => loadConfig({ BITUNIX_ENABLE_TRADING: "true" } as NodeJS.ProcessEnv));
});

test("config accepts valid setups", () => {
  const publicOnly = loadConfig({} as NodeJS.ProcessEnv);
  assert.equal(publicOnly.apiKey, null);
  assert.equal(publicOnly.tradingEnabled, false);

  const readOnly = loadConfig({
    BITUNIX_API_KEY: "abcdef1234567890",
    BITUNIX_SECRET_KEY: "abcdef1234567890",
  } as NodeJS.ProcessEnv);
  assert.equal(readOnly.tradingEnabled, false);
  assert.equal(readOnly.apiKey, "abcdef1234567890");
});
