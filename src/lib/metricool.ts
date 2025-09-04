import "server-only";
// lib/metricool.ts

import FormData from "form-data";

const METRICOOL_BASE_URL = "https://app.metricool.com/api";
const token = process.env.METRICOOL_TOKEN!;
const userId = process.env.METRICOOL_USER_ID!;
const blogId = process.env.METRICOOL_BLOG_ID!;

export interface CreatePostParams {
  accountId: string;
  text: string;
  date: string;
  network: string;
  imageUrl?: string;
  mediaId?: string; // Nuevo: se puede pasar directamente un mediaId (por ejemplo para vídeo)
}

interface SchedulerPostPayload {
  text?: string;
  publicationDate?: {
    dateTime: string;
    timezone: string;
  };
  providers?: {
    id?: string | number;
    network?: string;
  }[];
  media?: {
    mediaId: string;
  };
}

// Genérica
async function metricoolRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: object
) {
  if (!token || !userId || !blogId) {
    throw new Error("Faltan METRICOOL_TOKEN, METRICOOL_USER_ID o METRICOOL_BLOG_ID en el .env.local");
  }
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${METRICOOL_BASE_URL}${endpoint}${sep}blogId=${blogId}&userId=${userId}`;
  const headers: HeadersInit = { "X-Mc-Auth": token, "Content-Type": "application/json" };
  const res = method === "GET"
    ? await fetch(url, { method, headers })
    : await fetch(url, { method, headers, body: JSON.stringify(body || {}) });
  return handleResponse(res);
}

async function handleResponse(response: Response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type");
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: `;
    try {
      if (contentType?.includes("application/json")) {
        const errorData = JSON.parse(text);
        errorMessage += errorData.message || errorData.error || JSON.stringify(errorData);
      } else {
        errorMessage += text;
      }
    } catch {
      errorMessage += text || response.statusText;
    }
    console.error("❌ Metricool API Error:", errorMessage);
    throw new Error(errorMessage);
  }
  return contentType?.includes("application/json") ? JSON.parse(text) : text;
}

// 🔥 Sube un buffer de vídeo como media a Metricool
export async function uploadMetricoolMedia(buffer: ArrayBuffer, filename = "video.mp4") {
  if (!token || !blogId) throw new Error("Faltan variables de entorno Metricool");
  const url = `${METRICOOL_BASE_URL}/v1/blogs/${blogId}/media`;

  const form = new FormData();
  form.append("file", Buffer.from(buffer), filename);

  const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    ...form.getHeaders() as Record<string, string>,
  },
  body: form as unknown as BodyInit,
});


  if (!res.ok) {
    throw new Error(`Error subiendo media a Metricool: ${await res.text()}`);
  }
  const data = await res.json();
  return data.id || data.mediaId;
}

/**
 * Normaliza una URL de imagen o vídeo para obtener mediaId.
 */
export async function normalizeMetricoolMedia(url: string): Promise<string> {
  const encoded = encodeURIComponent(url);
  const data = await metricoolRequest(`/actions/normalize/image/url?url=${encoded}`, "GET");
  return data.mediaId || data.id;
}

/**
 * Crea un post en Metricool, opcionalmente adjuntando mediaId.
 * - Si pasas imageUrl, la normaliza (SOLO para imágenes).
 * - Si pasas mediaId, lo añade directo (ideal para vídeos).
 */
export async function createMetricoolPost({
  accountId,
  text,
  date,
  network,
  imageUrl,
  mediaId,
}: CreatePostParams): Promise<{ id: number }> {
  const payload: SchedulerPostPayload = {
    text,
    publicationDate: { dateTime: date, timezone: "Europe/Madrid" },
    providers: [{ id: accountId, network }],
  };
  if (mediaId) {
    payload.media = { mediaId }; // Para vídeo
  } else if (imageUrl) {
    const imgMediaId = await normalizeMetricoolMedia(imageUrl);
    payload.media = { mediaId: imgMediaId };
  }
  const data = await metricoolRequest("/v2/scheduler/posts", "POST", payload);
  const id = data.data?.id || data.id || data.content_id;
  return { id };
}

// Otros métodos para actualizar, eliminar y listar
export async function updateMetricoolPost(contentId: string, newData: Partial<CreatePostParams>): Promise<void> {
  const payload: SchedulerPostPayload = {};
  if (newData.text) payload.text = newData.text;
  if (newData.date) payload.publicationDate = { dateTime: newData.date, timezone: "Europe/Madrid" };
  if (newData.network || newData.accountId) payload.providers = [{ id: newData.accountId, network: newData.network }];
  if (newData.mediaId) payload.media = { mediaId: newData.mediaId };
  else if (newData.imageUrl) {
    const mediaId = await normalizeMetricoolMedia(newData.imageUrl);
    payload.media = { mediaId };
  }
  await metricoolRequest(`/v2/scheduler/posts/${contentId}`, "PUT", payload);
}

export async function deleteMetricoolPost(contentId: string): Promise<void> {
  await metricoolRequest(`/v2/scheduler/posts/${contentId}`, "DELETE");
}

export async function listMetricoolPosts(startDate: string, endDate: string) {
  return metricoolRequest(`/v2/scheduler/posts?startDate=${startDate}&endDate=${endDate}`, "GET");
}

/**
 * Valida que las credenciales de Metricool son correctas.
 */
export async function validateMetricoolCredentials(): Promise<boolean> {
  try {
    await metricoolRequest("/admin/simpleProfiles", "GET");
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve el listado de perfiles/marcas del usuario (para extraer IDs de redes).
 */
export async function getMetricoolProfiles() {
  return metricoolRequest("/admin/simpleProfiles", "GET");
}


