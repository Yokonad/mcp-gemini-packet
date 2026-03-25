import { z } from "zod";

const ExplainTraceInputSchema = z.object({
  traceOutput: z.string().min(1)
});

export const promptDefinitions = [
  {
    name: "analyze_trace",
    description: "Genera una guía para interpretar una salida de traceroute.",
    arguments: [
      {
        name: "traceOutput",
        description: "Salida textual del traceroute",
        required: true
      }
    ]
  }
] as const;

export function getPrompt(name: string, args: unknown) {
  if (name === "analyze_trace") {
    const parsed = ExplainTraceInputSchema.parse(args ?? {});
    return {
      description: "Prompt para análisis de traceroute",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analiza esta traza de red y explica posibles cuellos de botella:\n\n${parsed.traceOutput}`
          }
        }
      ]
    };
  }

  throw new Error(`Prompt no soportado: ${name}`);
}
