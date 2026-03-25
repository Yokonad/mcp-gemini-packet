import { z } from "zod";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { ensureLiveBridgeStarted, getLiveBridge } from "../bridge/liveBridge.js";

const BRIDGE_BASE_URL = "http://127.0.0.1:54321";
let lastBridgeRearmAt = 0;
let bridgeWatchdogStarted = false;
let bridgeIdleCycles = 0;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const BuildBasicTopologyInputSchema = z.object({
  profilePath: z.string().min(1).optional(),
  dryRun: z.boolean().optional()
});

const AddDeviceInputSchema = z.object({
  deviceName: z.string().min(1),
  deviceModel: z.string().min(1),
  x: z.number().int().min(0).default(100),
  y: z.number().int().min(0).default(100),
  dryRun: z.boolean().optional()
});

const AddLinkInputSchema = z.object({
  device1Name: z.string().min(1),
  device1Interface: z.string().min(1),
  device2Name: z.string().min(1),
  device2Interface: z.string().min(1),
  linkType: z.enum(["straight", "cross", "fiber", "phone", "coaxial", "serial", "console", "auto"]).default("auto"),
  dryRun: z.boolean().optional()
});

const ConfigureDeviceInputSchema = z.object({
  deviceName: z.string().min(1),
  commands: z.string().min(1),
  dryRun: z.boolean().optional()
});

const ConfigurePcIpInputSchema = z.object({
  deviceName: z.string().min(1),
  dhcpEnabled: z.boolean().default(false),
  ipAddress: z.string().optional(),
  subnetMask: z.string().optional(),
  defaultGateway: z.string().optional(),
  dnsServer: z.string().optional(),
  dryRun: z.boolean().optional()
});

const RunCustomJsInputSchema = z.object({
  jsCode: z.string().min(1),
  dryRun: z.boolean().optional()
});

const PtExecuteJsInputSchema = z.object({
  code: z.string().min(1),
  dryRun: z.boolean().optional()
});

const PtFullBuildInputSchema = z.object({
  request: z.string().min(1),
  dryRun: z.boolean().optional()
});

const PtBridgeAutoConnectInputSchema = z.object({
  profilePath: z.string().min(1).optional(),
  dryRun: z.boolean().optional()
});

const PtSendRawInputSchema = z.object({
  jsCode: z.string().min(1),
  waitResult: z.boolean().optional(),
  timeoutMs: z.number().int().min(500).max(60000).optional(),
  dryRun: z.boolean().optional()
});

const PtExportBridgeExtensionInputSchema = z.object({
  outputDir: z.string().min(1).optional(),
  bridgeUrl: z.string().url().optional()
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const toolDefinitions = [
  {
    name: "packet_tracer_build_basic_topology",
    description:
      "Construye una topologia basica en Cisco Packet Tracer: un router 2911, un switch 2960, un PC, los conecta entre si y configura una IP en el PC. Usa PTBuilder (ScriptModule) internamente.",
    inputSchema: {
      type: "object",
      properties: {
        profilePath: {
          type: "string",
          description: "Ruta del JSON de perfil (opcional). Default: config/packet-tracer-profile.json"
        },
        dryRun: {
          type: "boolean",
          description: "Si es true, solo genera y muestra el codigo JS sin ejecutarlo."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "packet_tracer_add_device",
    description:
      "Agrega un dispositivo en Packet Tracer. Modelos comunes: 2911, 2901, 1941 (routers), 2960-24TT, 3560-24PS (switches), PC-PT, Server-PT, Laptop-PT.",
    inputSchema: {
      type: "object",
      properties: {
        deviceName: { type: "string", description: "Nombre del dispositivo (ej: R1, S1, PC1)" },
        deviceModel: { type: "string", description: "Modelo del dispositivo (ej: 2911, 2960-24TT, PC-PT)" },
        x: { type: "number", description: "Posicion X en el canvas (default: 100)" },
        y: { type: "number", description: "Posicion Y en el canvas (default: 100)" },
        dryRun: { type: "boolean", description: "Solo genera el codigo sin ejecutarlo" }
      },
      required: ["deviceName", "deviceModel"],
      additionalProperties: false
    }
  },
  {
    name: "packet_tracer_add_link",
    description:
      "Conecta dos dispositivos en Packet Tracer. Tipos: auto, straight, cross, fiber, serial, console.",
    inputSchema: {
      type: "object",
      properties: {
        device1Name: { type: "string", description: "Nombre del primer dispositivo" },
        device1Interface: { type: "string", description: "Interfaz del primer dispositivo (ej: GigabitEthernet0/0)" },
        device2Name: { type: "string", description: "Nombre del segundo dispositivo" },
        device2Interface: { type: "string", description: "Interfaz del segundo dispositivo (ej: FastEthernet0/1)" },
        linkType: { type: "string", description: "Tipo de enlace: auto, straight, cross, fiber, serial, console" },
        dryRun: { type: "boolean", description: "Solo genera el codigo sin ejecutarlo" }
      },
      required: ["device1Name", "device1Interface", "device2Name", "device2Interface"],
      additionalProperties: false
    }
  },
  {
    name: "packet_tracer_configure_device",
    description:
      "Envia comandos IOS a un dispositivo Cisco en Packet Tracer (ej: hostname, interfaces, rutas).",
    inputSchema: {
      type: "object",
      properties: {
        deviceName: { type: "string", description: "Nombre del dispositivo destino" },
        commands: { type: "string", description: "Comandos IOS separados por \\n" },
        dryRun: { type: "boolean", description: "Solo genera el codigo sin ejecutarlo" }
      },
      required: ["deviceName", "commands"],
      additionalProperties: false
    }
  },
  {
    name: "packet_tracer_configure_pc_ip",
    description:
      "Configura la IP de un PC o Server en Packet Tracer.",
    inputSchema: {
      type: "object",
      properties: {
        deviceName: { type: "string", description: "Nombre del PC/Server" },
        dhcpEnabled: { type: "boolean", description: "Usar DHCP (default: false)" },
        ipAddress: { type: "string", description: "Direccion IP" },
        subnetMask: { type: "string", description: "Mascara de subred" },
        defaultGateway: { type: "string", description: "Gateway por defecto" },
        dnsServer: { type: "string", description: "Servidor DNS" },
        dryRun: { type: "boolean", description: "Solo genera el codigo sin ejecutarlo" }
      },
      required: ["deviceName"],
      additionalProperties: false
    }
  },
  {
    name: "packet_tracer_run_js",
    description:
      "Ejecuta codigo JavaScript personalizado en PTBuilder dentro de Packet Tracer. Funciones disponibles: addDevice, addLink, addModule, configureIosDevice, configurePcIp, getDevices.",
    inputSchema: {
      type: "object",
      properties: {
        jsCode: { type: "string", description: "Codigo JavaScript a ejecutar en PTBuilder" },
        dryRun: { type: "boolean", description: "Solo muestra el codigo sin ejecutarlo" }
      },
      required: ["jsCode"],
      additionalProperties: false
    }
  },
  {
    name: "pt_execute_js",
    description:
      "Compatibilidad estilo cisco-pt-mcp. Ejecuta codigo JavaScript PTBuilder (input: code).",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Codigo JS PTBuilder a ejecutar" },
        dryRun: { type: "boolean", description: "Solo muestra el codigo sin ejecutarlo" }
      },
      required: ["code"],
      additionalProperties: false
    }
  },
  {
    name: "pt_list_devices",
    description:
      "Genera y ejecuta un script JS para listar dispositivos del workspace en PTBuilder.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", description: "Solo muestra el codigo sin ejecutarlo" }
      },
      additionalProperties: false
    }
  },
  {
    name: "pt_full_build",
    description:
      "Pipeline en lenguaje natural: crea/ajusta topologia (router, switch, PCs, server), conecta, configura IP/gateway y puede reiniciar desde cero.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "Solicitud en lenguaje natural" },
        dryRun: { type: "boolean", description: "Solo muestra el codigo sin ejecutarlo" }
      },
      required: ["request"],
      additionalProperties: false
    }
  },
  {
    name: "pt_bridge_status",
    description:
      "Verifica si el Bridge HTTP interno esta activo y si Packet Tracer (PTBuilder) esta conectado por polling.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "pt_bridge_autoconnect",
    description:
      "Inyecta automaticamente el bootstrap del bridge en Builder Code Editor para conectar Packet Tracer sin pegar manualmente.",
    inputSchema: {
      type: "object",
      properties: {
        profilePath: { type: "string", description: "Ruta de perfil UI opcional" },
        dryRun: { type: "boolean", description: "Solo muestra el bootstrap sin ejecutarlo" }
      },
      additionalProperties: false
    }
  },
  {
    name: "pt_send_raw",
    description:
      "Envia JS arbitrario al bridge en vivo. Si waitResult=true, espera resultado via /result (requiere reportResult en PTBuilder).",
    inputSchema: {
      type: "object",
      properties: {
        jsCode: { type: "string", description: "Codigo JavaScript a enviar" },
        waitResult: { type: "boolean", description: "Esperar respuesta del bridge" },
        timeoutMs: { type: "number", description: "Timeout de espera en ms (solo waitResult)" },
        dryRun: { type: "boolean", description: "No envia al bridge; solo muestra codigo" }
      },
      required: ["jsCode"],
      additionalProperties: false
    }
  },
  {
    name: "pt_export_bridge_extension",
    description:
      "Genera kit bridge para PTBuilder conectado al bridge MCP (bootstrap y guia).",
    inputSchema: {
      type: "object",
      properties: {
        outputDir: { type: "string", description: "Directorio destino (default: config/bridge)" },
        bridgeUrl: { type: "string", description: "URL del bridge (default: http://127.0.0.1:54321)" }
      },
      additionalProperties: false
    }
  }
] as const;

ensureLiveBridgeStarted();
startBridgeWatchdog();

// ---------------------------------------------------------------------------
// JS code execution via PowerShell + PTBuilder
// ---------------------------------------------------------------------------

function executeJsViaPTBuilder(jsCode: string, dryRun: boolean, profilePathOverride?: string): string {
  const scriptPath = resolve(process.cwd(), "scripts/packetTracerAutomation.ps1");
  const defaultProfilePath = resolve(process.cwd(), "config", "packet-tracer-profile.json");
  const profilePath = profilePathOverride ? resolve(profilePathOverride) : defaultProfilePath;

  if (!existsSync(scriptPath)) {
    throw new Error(`No existe el script de automatizacion: ${scriptPath}`);
  }

  if (!existsSync(profilePath)) {
    throw new Error(`No existe el perfil de Packet Tracer: ${profilePath}`);
  }

  // Write JS code to a temp file to avoid quoting issues
  const tempDir = resolve(tmpdir(), "mcp-packet-tracer");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  const tempJsFile = resolve(tempDir, `ptbuilder_${Date.now()}.js`);
  writeFileSync(tempJsFile, jsCode, "utf-8");

  const psArgs = [
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
    "-Action", "ExecuteJS",
    "-JsFile", tempJsFile,
    "-ProfilePath", profilePath
  ];

  if (dryRun) {
    psArgs.push("-DryRun");
  }

  const result = spawnSync("powershell", psArgs, {
    encoding: "utf-8",
    timeout: 30000
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || "Fallo la ejecucion de PTBuilder.");
  }

  const output = result.stdout || "Ejecucion completada sin salida.";
  return output;
}

function executeJsPreferBridge(jsCode: string, dryRun: boolean, profilePathOverride?: string): string {
  const httpStatus = bridgeHttpGetStatus();
  const connected = Boolean(httpStatus?.connected);

  if (!dryRun) {
    if (!connected) {
      const now = Date.now();
      if (now - lastBridgeRearmAt > 5000) {
        lastBridgeRearmAt = now;
        try {
          const bridge = getLiveBridge();
          const bootstrap = bridge.bootstrapScript();
          executeJsViaPTBuilder(bootstrap, false, profilePathOverride);
        }
        catch {
          // ignora: se intentara via /queue o fallback normal
        }
      }
    }

    const queued = bridgeHttpQueue(jsCode);
    if (queued) {
      const refreshed = bridgeHttpGetStatus();
      return JSON.stringify({
        status: "success",
        transport: "bridge-http",
        bridge: {
          connected: Boolean(refreshed?.connected ?? httpStatus?.connected),
          running: Boolean(refreshed?.running ?? httpStatus?.running),
          queueDepth: Number(refreshed?.queueDepth ?? httpStatus?.queueDepth ?? 0),
          polls: Number(refreshed?.polls ?? httpStatus?.polls ?? 0),
          lastEvent: String(refreshed?.lastEvent ?? httpStatus?.lastEvent ?? "unknown")
        },
        result: "Comando encolado y enviado a Packet Tracer por bridge (/next)."
      });
    }
  }

  const fallback = executeJsViaPTBuilder(jsCode, dryRun, profilePathOverride);
  return `${fallback}\n${JSON.stringify({
    transport: "ptbuilder-ui-fallback",
    bridgeConnected: Boolean(httpStatus?.connected),
    note: "Bridge no conectado; se uso ejecucion UI directa."
  })}`;
}

function bridgeHttpGetStatus(): { [key: string]: unknown } | null {
  const cmd = `try { (Invoke-WebRequest -Uri '${BRIDGE_BASE_URL}/status' -UseBasicParsing -TimeoutSec 2).Content } catch { '' }`;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", cmd], {
    encoding: "utf-8",
    timeout: 5000
  });

  if (result.error) {
    return null;
  }

  const raw = (result.stdout ?? "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { [key: string]: unknown };
    return {
      connected: parsed.connected,
      pollingActive: parsed.polling_active,
      packetTracerRunning: parsed.packet_tracer_running,
      running: parsed.running,
      queueDepth: parsed.queueDepth,
      lastPollAgo: parsed.last_poll_ago,
      polls: parsed.polls,
      queued: parsed.queued,
      resultsReceived: parsed.results_received,
      lastEvent: parsed.last_event
    };
  }
  catch {
    return null;
  }
}

function bridgeHttpQueue(jsCode: string): boolean {
  const escaped = jsCode.replace(/'/g, "''");
  const cmd = `$body='${escaped}'; try { $r = Invoke-WebRequest -Uri '${BRIDGE_BASE_URL}/queue' -Method POST -Body $body -ContentType 'text/plain' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){'OK'} else {'FAIL'} } catch { 'FAIL' }`;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", cmd], {
    encoding: "utf-8",
    timeout: 8000
  });

  if (result.error) {
    return false;
  }

  return (result.stdout ?? "").trim().includes("OK");
}

function bridgeHttpWaitResult(timeoutMs: number): string | null {
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const cmd = `try { $r = Invoke-WebRequest -Uri '${BRIDGE_BASE_URL}/result' -UseBasicParsing -TimeoutSec ${timeoutSec}; if($r.StatusCode -eq 200){$r.Content}else{''} } catch { '' }`;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", cmd], {
    encoding: "utf-8",
    timeout: timeoutMs + 2000
  });

  if (result.error) {
    return null;
  }

  const raw = (result.stdout ?? "").trim();
  return raw.length > 0 ? raw : null;
}

function startBridgeWatchdog() {
  if (bridgeWatchdogStarted) {
    return;
  }

  bridgeWatchdogStarted = true;

  const timer = setInterval(() => {
    try {
      const status = bridgeHttpGetStatus();
      if (!status) {
        return;
      }

      const running = Boolean(status.running);
      const packetTracerRunning = Boolean(status.packetTracerRunning);
      const pollingActive = Boolean(status.pollingActive);
      const connected = Boolean(status.connected);
      const lastPollAgo = Number(status.lastPollAgo ?? 9999);

      if (!(running && packetTracerRunning)) {
        bridgeIdleCycles = 0;
        return;
      }

      const looksIdle = !pollingActive || !connected || lastPollAgo > 8;
      if (!looksIdle) {
        bridgeIdleCycles = 0;
        return;
      }

      bridgeIdleCycles += 1;
      if (bridgeIdleCycles < 2) {
        return;
      }

      const now = Date.now();
      if (now - lastBridgeRearmAt < 15000) {
        return;
      }

      lastBridgeRearmAt = now;
      const bootstrap = getLiveBridge().bootstrapScript();
      executeJsViaPTBuilder(bootstrap, false);
      bridgeIdleCycles = 0;
    }
    catch {
      // watchdog best-effort
    }
  }, 4000);

  if (typeof (timer as NodeJS.Timeout).unref === "function") {
    (timer as NodeJS.Timeout).unref();
  }
}

function exportBridgeExtension(outputDirOverride?: string, bridgeUrlOverride?: string): string {
  const bridgeUrl = bridgeUrlOverride ?? "http://127.0.0.1:54321";
  const outputDir = outputDirOverride ? resolve(outputDirOverride) : resolve(process.cwd(), "config", "bridge");

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const bootstrap = `/* Bridge */ window.webview.evaluateJavaScriptAsync("setInterval(function(){var x=new XMLHttpRequest();x.open('GET','${bridgeUrl}/next',true);x.onload=function(){if(x.status===200&&x.responseText){$se('runCode',x.responseText)}};x.onerror=function(){};x.send()},350)");`;

  const installSteps = [
    "1) NO reemplaces archivos core del modulo Builder (main.js, userfunctions.js, runcode.js, etc.).",
    "2) Abre Packet Tracer > Extensions > Builder Code Editor.",
    "3) Inyecta bridge con pt_bridge_autoconnect o pegando bridge-bootstrap.js y pulsando Run.",
    "4) Desde Gemini ejecuta pt_bridge_status para verificar connected=true.",
    "5) Luego usa pt_full_build o pt_execute_js normalmente.",
    "",
    "Si Builder Code Editor desaparece, reinstala config/Builder.pts desde Configure PT Script Modules."
  ].join("\n");

  const bootstrapPath = resolve(outputDir, "bridge-bootstrap.js");
  const installPath = resolve(outputDir, "install-steps.txt");

  writeFileSync(bootstrapPath, `${bootstrap}\n`, "utf-8");
  writeFileSync(installPath, `${installSteps}\n`, "utf-8");

  return [
    "Bridge Kit generado:",
    `- ${outputDir}`,
    "",
    "Archivos:",
    `- ${bootstrapPath}`,
    `- ${installPath}`
  ].join("\n");
}

function makeTextResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function toJsStringLiteral(value: string) {
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export function executeTool(name: string, args: unknown) {

  // === BUILD BASIC TOPOLOGY ===
  if (name === "packet_tracer_build_basic_topology") {
    const parsed = BuildBasicTopologyInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;

    const jsCode = [
      '// Topologia basica: Router + Switch + PC',
      'addDevice("R1", "2911", 500, 150);',
      'addDevice("S1", "2960-24TT", 500, 280);',
      'addDevice("PC1", "PC-PT", 500, 430);',
      '',
      '// Conexiones',
      'addLink("R1", "GigabitEthernet0/0", "S1", "GigabitEthernet0/1", "straight");',
      'addLink("S1", "FastEthernet0/1", "PC1", "FastEthernet0", "straight");',
      '',
      '// Configurar Router',
      'configureIosDevice("R1", "hostname R1\\ninterface GigabitEthernet0/0\\nip address 192.168.1.1 255.255.255.0\\nno shutdown");',
      '',
      '// Configurar PC',
      'configurePcIp("PC1", false, "192.168.1.10", "255.255.255.0", "192.168.1.1");'
    ].join("\n");

    const output = executeJsPreferBridge(jsCode, dryRun, parsed.profilePath);
    return makeTextResult(output);
  }

  // === ADD DEVICE ===
  if (name === "packet_tracer_add_device") {
    const parsed = AddDeviceInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const jsCode = `addDevice("${parsed.deviceName}", "${parsed.deviceModel}", ${parsed.x}, ${parsed.y});`;
    const output = executeJsPreferBridge(jsCode, dryRun);
    return makeTextResult(output);
  }

  // === ADD LINK ===
  if (name === "packet_tracer_add_link") {
    const parsed = AddLinkInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const jsCode = `addLink("${parsed.device1Name}", "${parsed.device1Interface}", "${parsed.device2Name}", "${parsed.device2Interface}", "${parsed.linkType}");`;
    const output = executeJsPreferBridge(jsCode, dryRun);
    return makeTextResult(output);
  }

  // === CONFIGURE IOS DEVICE ===
  if (name === "packet_tracer_configure_device") {
    const parsed = ConfigureDeviceInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const jsCode = `configureIosDevice(${toJsStringLiteral(parsed.deviceName)}, ${toJsStringLiteral(parsed.commands)});`;
    const output = executeJsPreferBridge(jsCode, dryRun);
    return makeTextResult(output);
  }

  // === CONFIGURE PC IP ===
  if (name === "packet_tracer_configure_pc_ip") {
    const parsed = ConfigurePcIpInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;

    const params = [`"${parsed.deviceName}"`, String(parsed.dhcpEnabled)];
    if (parsed.ipAddress) params.push(`"${parsed.ipAddress}"`);
    if (parsed.subnetMask) params.push(`"${parsed.subnetMask}"`);
    if (parsed.defaultGateway) params.push(`"${parsed.defaultGateway}"`);
    if (parsed.dnsServer) params.push(`"${parsed.dnsServer}"`);

    const jsCode = `configurePcIp(${params.join(", ")});`;
    const output = executeJsPreferBridge(jsCode, dryRun);
    return makeTextResult(output);
  }

  // === RUN CUSTOM JS ===
  if (name === "packet_tracer_run_js") {
    const parsed = RunCustomJsInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const output = executeJsPreferBridge(parsed.jsCode, dryRun);
    return makeTextResult(output);
  }

  // === COMPAT: pt_execute_js ===
  if (name === "pt_execute_js") {
    const parsed = PtExecuteJsInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const output = executeJsPreferBridge(parsed.code, dryRun);
    return makeTextResult(output);
  }

  // === COMPAT: pt_list_devices ===
  if (name === "pt_list_devices") {
    const parsed = z.object({ dryRun: z.boolean().optional() }).parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const jsCode = [
      'const devs = getDevices();',
      'const names = devs.map(d => d.name || d.deviceName || "(sin_nombre)");',
      'console.log("DISPOSITIVOS(" + names.length + "): " + names.join(", "));'
    ].join("\n");
    const output = executeJsPreferBridge(jsCode, dryRun);
    return makeTextResult(output);
  }

  // === COMPAT: pt_full_build ===
  if (name === "pt_full_build") {
    const parsed = PtFullBuildInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const requestLower = parsed.request.toLowerCase();

    const matchPcs = requestLower.match(/(\d+)\s*(pc|pcs|computador|computadores)/i);
    const matchRouters = requestLower.match(/(\d+)\s*(router|routers)/i);
    const matchSwitches = requestLower.match(/(\d+)\s*(switch|switches)/i);
    const matchServers = requestLower.match(/(\d+)\s*(server|servidor|servidores)/i);

    const pcCount = Math.max(1, Math.min(matchPcs ? Number(matchPcs[1]) : 2, 20));
    const routerCount = Math.max(1, Math.min(matchRouters ? Number(matchRouters[1]) : 1, 5));
    const switchCount = Math.max(1, Math.min(matchSwitches ? Number(matchSwitches[1]) : 1, 5));
    const serverCount = Math.max(0, Math.min(matchServers ? Number(matchServers[1]) : (/server|servidor/.test(requestLower) ? 1 : 0), 10));

    const wantsReset = /(eliminar todo|elimina todo|borrar todo|limpiar todo|resetear|reiniciar|desde cero|nuevo desde cero)/i.test(requestLower);

    const lines: string[] = [
      "const __devs = (typeof getDevices === 'function') ? getDevices() : [];",
      "const __names = new Set(__devs.map(d => d.name || d.deviceName).filter(Boolean));",
      "function __ensureDevice(name, model, x, y) {",
      "  if (!__names.has(name)) { addDevice(name, model, x, y); __names.add(name); }",
      "}",
      ""
    ];

    if (wantsReset) {
      lines.push(
        "if (typeof getDevices === 'function' && typeof deleteDevice === 'function') {",
        "  const __all = getDevices();",
        "  for (const d of __all) {",
        "    const n = d.name || d.deviceName;",
        "    if (n) { deleteDevice(n); }",
        "  }",
        "}",
        ""
      );
    }

    const centerX = 600;
    const switchGap = 220;
    const routerGap = 230;
    const endpointGap = 90;

    for (let index = 1; index <= switchCount; index++) {
      const x = Math.round(centerX - ((switchCount - 1) * switchGap) / 2 + (index - 1) * switchGap);
      lines.push(`__ensureDevice("SW${index}", "2960-24TT", ${x}, 230);`);
    }

    for (let index = 1; index <= routerCount; index++) {
      const x = Math.round(centerX - ((routerCount - 1) * routerGap) / 2 + (index - 1) * routerGap);
      lines.push(`__ensureDevice("R${index}", "2911", ${x}, 120);`);
      lines.push(`addLink("R${index}", "GigabitEthernet0/0", "SW1", "GigabitEthernet0/${Math.min(index, 2)}", "straight");`);
      lines.push(`configureIosDevice("R${index}", "hostname R${index}\\ninterface GigabitEthernet0/0\\nip address 192.168.${index}.1 255.255.255.0\\nno shutdown");`);
    }

    for (let index = 1; index <= pcCount; index++) {
      const x = Math.round(centerX - ((pcCount - 1) * endpointGap) / 2 + (index - 1) * endpointGap);
      const y = 430;
      lines.push(`__ensureDevice("PC${index}", "PC-PT", ${x}, ${y});`);
      lines.push(`addLink("SW1", "FastEthernet0/${index}", "PC${index}", "FastEthernet0", "straight");`);
      lines.push(`configurePcIp("PC${index}", false, "192.168.1.${9 + index}", "255.255.255.0", "192.168.1.1");`);
    }

    for (let index = 1; index <= serverCount; index++) {
      const x = Math.round(centerX - ((serverCount - 1) * endpointGap) / 2 + (index - 1) * endpointGap);
      const y = 360;
      const port = pcCount + index;
      lines.push(`__ensureDevice("SRV${index}", "Server-PT", ${x}, ${y});`);
      lines.push(`addLink("SW1", "FastEthernet0/${port}", "SRV${index}", "FastEthernet0", "straight");`);
      lines.push(`configurePcIp("SRV${index}", false, "192.168.1.${19 + index}", "255.255.255.0", "192.168.1.1");`);
    }

    const jsCode = lines.join("\n");
    const output = executeJsPreferBridge(jsCode, dryRun);
    return makeTextResult(output);
  }

  // === BRIDGE STATUS ===
  if (name === "pt_bridge_status") {
    const bridge = getLiveBridge();
    const status = bridge.getStatus();
    const httpStatus = bridgeHttpGetStatus();
    const bootstrap = bridge.bootstrapScript();

    const running = Boolean(httpStatus?.running ?? status.running);
    const connected = Boolean(httpStatus?.connected ?? status.connected);
    const pollingActive = Boolean(httpStatus?.pollingActive ?? status.pollingActive);
    const packetTracerRunning = Boolean(httpStatus?.packetTracerRunning ?? false);
    const queueDepth = Number(httpStatus?.queueDepth ?? status.queueDepth);
    const lastPollAgo = httpStatus?.lastPollAgo ?? status.lastPollAgoSeconds ?? "null";
    const polls = Number(httpStatus?.polls ?? status.polls);
    const queued = Number(httpStatus?.queued ?? status.queued);
    const resultsReceived = Number(httpStatus?.resultsReceived ?? status.resultsReceived);
    const lastEvent = String(httpStatus?.lastEvent ?? status.lastEvent);

    const checks = [
      `CHECK bridge_running=${running ? "OK" : "FAIL"}`,
      `CHECK bridge_connected=${connected ? "OK" : "FAIL"}`,
      `CHECK bridge_polling_active=${pollingActive ? "OK" : "WARN"}`,
      `CHECK packet_tracer_running=${packetTracerRunning ? "OK" : "FAIL"}`,
      `CHECK polls=${polls}`,
      `CHECK queued=${queued}`,
      `CHECK results_received=${resultsReceived}`,
      `CHECK queue_depth=${queueDepth}`,
      `CHECK last_event=${lastEvent}`,
      `CHECK last_poll_ago=${lastPollAgo}`
    ];

    const text = [
      `Bridge running: ${running}`,
      `Bridge connected: ${connected}`,
      `Bridge pollingActive: ${pollingActive}`,
      `Packet Tracer running: ${packetTracerRunning}`,
      `Bridge queueDepth: ${queueDepth}`,
      `Bridge lastPollAgoSeconds: ${lastPollAgo}`,
      `Bridge polls: ${polls}`,
      `Bridge queued: ${queued}`,
      `Bridge resultsReceived: ${resultsReceived}`,
      `Bridge lastEvent: ${lastEvent}`,
      "",
      "Diagnostico:",
      ...checks,
      "",
      "Bootstrap (si no esta conectado):",
      bootstrap
    ].join("\n");

    return makeTextResult(text);
  }

  // === BRIDGE AUTO-CONNECT ===
  if (name === "pt_bridge_autoconnect") {
    const parsed = PtBridgeAutoConnectInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const bridge = getLiveBridge();
    const bootstrap = bridge.bootstrapScript();

    const output = executeJsViaPTBuilder(bootstrap, dryRun, parsed.profilePath);
    const status = bridge.getStatus();
    const text = [
      output,
      "",
      `Bridge connected: ${status.connected}`,
      "Si sigue false, espera 1-2s y ejecuta pt_bridge_status."
    ].join("\n");

    return makeTextResult(text);
  }

  // === BRIDGE RAW SEND ===
  if (name === "pt_send_raw") {
    const parsed = PtSendRawInputSchema.parse(args ?? {});
    const dryRun = parsed.dryRun ?? false;
    const waitResult = parsed.waitResult ?? false;
    const timeoutMs = parsed.timeoutMs ?? 10000;
    const bridge = getLiveBridge();

    if (dryRun) {
      return makeTextResult(parsed.jsCode);
    }

    if (waitResult) {
      const wrapped = [
        "try {",
        `  var __r = (function(){ ${parsed.jsCode} })();`,
        "  reportResult(String(__r));",
        "} catch(__e) {",
        "  reportResult('ERROR:' + __e);",
        "}"
      ].join("\n");
      if (!bridgeHttpQueue(wrapped)) {
        return makeTextResult("No se pudo encolar el comando en /queue.");
      }

      const waited = bridgeHttpWaitResult(timeoutMs);
      return makeTextResult(waited ?? "Sin respuesta (timeout). Verifica bridge y reportResult().");
    }

    const sent = bridgeHttpQueue(parsed.jsCode);
    if (sent) {
      return makeTextResult("Comando encolado en bridge.");
    }

    bridge.enqueue(parsed.jsCode);
    return makeTextResult("Comando encolado localmente (fallback).");
  }

  // === EXPORT BRIDGE EXTENSION ===
  if (name === "pt_export_bridge_extension") {
    const parsed = PtExportBridgeExtensionInputSchema.parse(args ?? {});
    const output = exportBridgeExtension(parsed.outputDir, parsed.bridgeUrl);
    return makeTextResult(output);
  }

  throw new Error(`Herramienta no soportada: ${name}`);
}
