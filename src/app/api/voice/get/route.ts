// Endpoint genérico para el cliente; reutiliza tu implementación actual
// sin exponer el nombre del proveedor en /api/voice/get.

export { GET } from "@/app/api/elevenlabs/voice/get/route";

// Si quisieras forzar comportamiento dinámico (sin caché de Next),
// podrías descomentar la siguiente línea. La dejo comentada para
// no cambiar la semántica original del endpoint.
// export const dynamic = "force-dynamic";
