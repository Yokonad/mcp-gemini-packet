(async () => {
	const { executeJsPreferBridge } = await import("../../dist/tools/index.js");
	console.log("Testeando puente...");
	const res = executeJsPreferBridge('var d=ipc.network().getDevice("R-Izq"); if(d) { var out=d.enterCommand("show ip interface brief", "enable"); out; } else { "NOT FOUND"; }', false);
	console.log("RESULTADO TEST:", res);
})();
