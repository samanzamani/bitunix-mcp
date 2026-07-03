/**
 * Configuration is read exclusively from environment variables. API
 * credentials are never accepted as tool arguments, never echoed back to the
 * client, and never written to disk or logs.
 */

export interface Config {
  apiKey: string | null;
  secretKey: string | null;
  tradingEnabled: boolean;
}

const API_KEY_PATTERN = /^[A-Za-z0-9]{8,128}$/;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.BITUNIX_API_KEY?.trim() || null;
  const secretKey = env.BITUNIX_SECRET_KEY?.trim() || null;

  if ((apiKey === null) !== (secretKey === null)) {
    throw new Error(
      "BITUNIX_API_KEY and BITUNIX_SECRET_KEY must be set together (or both omitted for public market data only)."
    );
  }
  if (apiKey && !API_KEY_PATTERN.test(apiKey)) {
    throw new Error("BITUNIX_API_KEY has an unexpected format.");
  }
  if (secretKey && !API_KEY_PATTERN.test(secretKey)) {
    throw new Error("BITUNIX_SECRET_KEY has an unexpected format.");
  }

  const tradingEnabled = env.BITUNIX_ENABLE_TRADING === "true";
  if (tradingEnabled && !apiKey) {
    throw new Error("BITUNIX_ENABLE_TRADING=true requires API credentials to be set.");
  }

  return { apiKey, secretKey, tradingEnabled };
}
