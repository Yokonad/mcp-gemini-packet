<div align="center">

# <span style="color:#00f0ff">mcp-packet-tracer</span>

**Servidor MCP para controlar Cisco Packet Tracer con Gemini CLI usando tools en lenguaje natural.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Cisco](https://img.shields.io/badge/Cisco-Packet%20Tracer-1BA0D7?style=flat-square&logo=cisco&logoColor=white)](https://www.netacad.com/courses/packet-tracer)
[![MCP](https://img.shields.io/badge/Protocol-MCP-blueviolet?style=flat-square)](https://modelcontextprotocol.io/)

</div>

---

## <span style="color:#00ff88">Requisitos</span>

- Windows
- Node.js 18+
- Cisco Packet Tracer instalado
- Gemini CLI instalado

## <span style="color:#00ff88">Instalacion</span>

```powershell
npm install
npm run build
```

## <span style="color:#00ff88">Inicio Rapido</span>

```powershell
.\run-mcp-packet-tracer.cmd
```

El launcher:
1. Muestra `.pkt` de Descargas para elegir.
2. Permite crear un `.pkt` nuevo.
3. Arranca MCP server automaticamente.
4. Abre Gemini CLI.

## <span style="color:#00ff88">Tools Principales</span>

| Tool | Descripcion |
|------|-------------|
| `packet_tracer_build_basic_topology` | Construye topologia basica completa |
| `packet_tracer_add_device` | Agrega dispositivo a la topologia |
| `packet_tracer_add_link` | Crea enlace entre dispositivos |
| `packet_tracer_configure_device` | Configura un dispositivo (CLI commands) |
| `packet_tracer_configure_pc_ip` | Configura IP de un PC |
| `pt_full_build` | Build completo de topologia |
| `pt_bridge_status` | Estado del bridge en tiempo real |
| `pt_bridge_autoconnect` | Auto-conexion bridge con PTBuilder |
| `pt_send_raw` | Envia codigo JS raw al bridge |
| `pt_export_bridge_extension` | Exporta extension del bridge |

## <span style="color:#00ff88">Diagnostico</span>

| Endpoint | URL |
|----------|-----|
| Monitor visual | `http://127.0.0.1:54321/monitor` |
| Estado JSON | `http://127.0.0.1:54321/status` |

## <span style="color:#00ff88">Notas</span>

- Manten abierto Builder Code Editor (puede estar minimizado).
- Si algo no ejecuta, corre `pt_bridge_autoconnect` y luego `pt_bridge_status`.
