import { z } from "zod";

/**
 * Strict input validation shared by all tools. Everything that ends up in a
 * query string or request body must pass one of these schemas first.
 */

export const symbolSchema = z
  .string()
  .regex(/^[A-Z0-9]{2,20}$/, "Symbol must be uppercase alphanumeric, e.g. BTCUSDT");

export const coinSchema = z
  .string()
  .regex(/^[A-Z0-9]{1,15}$/, "Coin must be uppercase alphanumeric, e.g. USDT");

/** Positive decimal encoded as a string, as the Bitunix API expects. */
export const decimalSchema = z
  .string()
  .regex(/^(?!0+(\.0+)?$)\d{1,20}(\.\d{1,20})?$/, "Must be a positive decimal string, e.g. \"0.001\"");

export const orderIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Order id must be alphanumeric");

export const timestampMsSchema = z
  .number()
  .int()
  .min(0)
  .max(9_999_999_999_999);

export const futuresIntervalSchema = z.enum([
  "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "8h", "12h",
  "1d", "3d", "1w", "1M",
]);

export const spotIntervalSchema = z.enum([
  "1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W",
]);

export const sideSchema = z.enum(["BUY", "SELL"]);
export const futuresOrderTypeSchema = z.enum(["LIMIT", "MARKET"]);
export const effectSchema = z.enum(["GTC", "IOC", "FOK", "POST_ONLY"]);
export const tradeSideSchema = z.enum(["OPEN", "CLOSE"]);
export const stopTypeSchema = z.enum(["MARK_PRICE", "LAST_PRICE"]);
