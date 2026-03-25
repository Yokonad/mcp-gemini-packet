import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { getPrompt, promptDefinitions } from "./prompts/index.js";
import { readResource, resourceDefinitions } from "./resources/index.js";
import { executeTool, toolDefinitions } from "./tools/index.js";

const server = new Server(
  {
    name: "packet-tracer-helper",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...toolDefinitions] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return executeTool(request.params.name, request.params.arguments);
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: [...resourceDefinitions] };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return readResource(request.params.uri);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: [...promptDefinitions] };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  return getPrompt(request.params.name, request.params.arguments);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Error iniciando servidor MCP:", error);
  process.exit(1);
});
