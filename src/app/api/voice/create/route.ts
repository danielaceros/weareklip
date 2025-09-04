// Reexportamos la lógica existente del proveedor para no duplicar código
// y evitar tocar tu implementación interna. Esto mantiene todo funcionando,
// pero desde el cliente solo se ve /api/voice/create (genérico).

export { POST, dynamic } from "@/app/api/elevenlabs/voice/create/route";
