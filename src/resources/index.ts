export const resourceDefinitions = [
  {
    uri: "packet-tracer://topology/default",
    name: "Topología base",
    description: "Topología inicial de ejemplo para pruebas de red.",
    mimeType: "application/json"
  }
] as const;

export function readResource(uri: string) {
  if (uri === "packet-tracer://topology/default") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              nodes: [
                { id: "R1", type: "router" },
                { id: "SW1", type: "switch" },
                { id: "PC1", type: "pc" }
              ],
              links: [
                ["R1", "SW1"],
                ["SW1", "PC1"]
              ]
            },
            null,
            2
          )
        }
      ]
    };
  }

  throw new Error(`Recurso no soportado: ${uri}`);
}
