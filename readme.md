<div align="center">

![MCP PACKET TRACER](https://img.shields.io/badge/MCP_PACKET_TRACER-00F0FF?style=for-the-badge&labelColor=000000)

**Servidor MCP para controlar Cisco Packet Tracer con Gemini CLI usando tools en lenguaje natural.**

> ⚠️ **BETA:** Este proyecto está en fase beta. Puede cambiar sin previo aviso y algunas funciones pueden ser inestables según la versión de Cisco Packet Tracer.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Cisco](https://img.shields.io/badge/Cisco-Packet%20Tracer-1BA0D7?style=flat-square&logo=cisco&logoColor=white)](https://www.netacad.com/courses/packet-tracer)
[![MCP](https://img.shields.io/badge/Protocol-MCP-blueviolet?style=flat-square)](https://modelcontextprotocol.io/)

<a href="https://tenor.com/view/konata-lucky-star-thinking-loading-anime-gif-15680289644544200178">
  <img src="https://media1.tenor.com/m/2ZuUWp5LDfIAAAAC/konata-lucky-star.gif" width="300" alt="Konata Lucky Star GIF Loading" />
</a>
<br>

</div>

---

![Requisitos](https://img.shields.io/badge/REQUISITOS_Y_CONFIGURACION-FF007F?style=for-the-badge)

Para que el servidor MCP se comunique correctamente, asegúrate de tener todo esto listo antes de iniciar:

1. **Sistema Operativo:** Windows.
2. **Node.js:** Versión 18 o superior instalada.
3. **Cisco Packet Tracer:** Instalado y cerrado (el launcher lo abrirá por ti).
4. **Extensión BridgeBuilder (Crucial):** Packet Tracer necesita tu script module persistente para permitir inyección de scripts. Si no lo tienes cargado aún, instálalo con:
   ```powershell
   .\scripts\install-bridgebuilder.ps1
   ```
5. **Gemini CLI:** Debes tenerlo instalado globalmente (`npm install -g @google/gemini-cli`). Si es tu primera vez usándolo, asegúrate de haber ejecutado antes `gemini login` para autorizar tu cuenta.

![Instalacion](https://img.shields.io/badge/INSTALACION-FF007F?style=for-the-badge)

```powershell
npm install
npm run build
```

![Inicio](https://img.shields.io/badge/INICIO_RAPIDO-FF007F?style=for-the-badge)

```powershell
.\run-mcp-packet-tracer.cmd
```

El launcher:
1. Muestra `.pkt` de Descargas para elegir.
2. Permite crear un `.pkt` nuevo.
3. Arranca MCP server automaticamente.
4. Abre Gemini CLI.

### Activación MANUAL del Bridge en Packet Tracer
Aunque el launcher abre todo automáticamente, el puente de comunicación requiere que actives la interfaz de tu extensión:
1. Ve al menú superior y selecciona **`Extensions`** -> **`Scripting`** -> **`Edit File Script Module`** -> **`BridgeBuilder`**.
2. Abre la interfaz `Conectar` y pulsa **`Correr`** (botón verde).
3. Deja la ventanita abierta o minimizada mientras trabajas para mantener conexión persistente.

![Tools](https://img.shields.io/badge/TOOLS_PRINCIPALES-FF007F?style=for-the-badge)

| Tool | Descripcion |
|------|-------------|
| `packet_tracer_build_basic_topology` | Construye topologia basica completa |
| `packet_tracer_add_device` | Agrega dispositivo a la topologia |
| `packet_tracer_add_link` | Crea enlace entre dispositivos |
| `packet_tracer_configure_device` | Configura un dispositivo (CLI commands) |
| `packet_tracer_configure_pc_ip` | Configura IP de un PC |
| `pt_full_build` | Build completo de topologia |
| `pt_bridge_status` | Estado del bridge en tiempo real |
| `pt_bridge_autoconnect` | Auto-conexion bridge con BridgeBuilder |
| `pt_send_raw` | Envia codigo JS raw al bridge |
| `pt_export_bridge_extension` | Exporta extension del bridge |

![Diagnostico](https://img.shields.io/badge/DIAGNOSTICO-FF007F?style=for-the-badge)

| Endpoint | URL |
|----------|-----|
| Monitor visual | `http://127.0.0.1:54321/monitor` |
| Estado JSON | `http://127.0.0.1:54321/status` |

![Notas](https://img.shields.io/badge/NOTAS-FF007F?style=for-the-badge)

- Mantén abierto BridgeBuilder (puede estar minimizado).
- Si algo no ejecuta, corre `pt_bridge_autoconnect` y luego `pt_bridge_status`.

## Autoría y créditos

- Certificado de autoría: [CERTIFICADO-DE-AUTORIA.md](CERTIFICADO-DE-AUTORIA.md)
- Licencia de uso y créditos obligatorios: [LICENSE.md](LICENSE.md)
- Aviso legal de distribución: [NOTICE.md](NOTICE.md)
