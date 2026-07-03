#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { BitunixClient } from "./http.js";
import { registerFuturesTools } from "./tools/futures.js";
import { registerSpotTools } from "./tools/spot.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new BitunixClient(config);

  const server = new McpServer({
    name: "bitunix-mcp",
    version: "0.1.0",
  });

  registerFuturesTools(server, client, config);
  registerSpotTools(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Status goes to stderr only — stdout is reserved for the MCP protocol.
  const mode = config.tradingEnabled
    ? "trading ENABLED"
    : config.apiKey
      ? "read-only (private reads available)"
      : "public market data only";
  console.error(`bitunix-mcp started — ${mode}`);
}

main().catch((err) => {
  console.error(`bitunix-mcp failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
