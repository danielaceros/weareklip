import { createMetricoolPost, validateMetricoolCredentials } from "@/lib/metricool";
import { adminDB } from "@/lib/firebase-admin";


import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, calendarId, text, date, network, imageUrl, accountId } = body;

    // Validaciones de campos obligatorios
    if (!uid || !calendarId || !text || !date || !network || !accountId) {
      return NextResponse.json(
        {
          error: "Faltan campos obligatorios",
          required: ["uid", "calendarId", "text", "date", "network", "accountId"],
        },
        { status: 400 }
      );
    }

    // Verificar que el evento existe
    const eventRef = adminDB.doc(`users/${uid}/calendario/${calendarId}`);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json(
        { error: "El evento no existe en el calendario" },
        { status: 404 }
      );
    }

    // Verificar que no esté ya sincronizado
    const eventData = eventSnap.data() as {
      syncedWithMetricool?: boolean;
      metricoolId?: string;
    };
    if (eventData.syncedWithMetricool && eventData.metricoolId) {
      return NextResponse.json(
        {
          error: "Este evento ya está sincronizado con Metricool",
          metricoolId: eventData.metricoolId,
        },
        { status: 409 }
      );
    }

    // Validar credenciales de Metricool
    const credentialsValid = await validateMetricoolCredentials();
    if (!credentialsValid) {
      return NextResponse.json(
        {
          error:
            "Credenciales de Metricool inválidas. Verifica METRICOOL_TOKEN, METRICOOL_USER_ID y METRICOOL_BLOG_ID",
        },
        { status: 401 }
      );
    }

    // ==== NUEVO: Descargar el video de imageUrl si existe y la red es Instagram ====
    if (imageUrl && network === "instagram") {
      const videoRes = await fetch(imageUrl);
      if (!videoRes.ok) {
        return NextResponse.json({ error: "No se pudo descargar el vídeo" }, { status: 500 });
      }
      const videoBuffer = await videoRes.arrayBuffer();
      // Log temporal para comprobar el tamaño del vídeo descargado
      console.log("Tamaño del buffer del vídeo:", videoBuffer.byteLength, "bytes");
      // Aquí termina el paso 1 (de momento NO lo subimos, solo descarga)
    }

    // -- Continúa con la lógica habitual (NO subimos el video aún a Metricool) --
    const response = await createMetricoolPost({
      accountId,
      text,
      date,
      network,
      imageUrl: imageUrl || undefined, // Se envía solo la URL como antes
    });

    const metricoolId = response.id;
    if (!metricoolId) {
      throw new Error("Metricool no devolvió un ID válido");
    }

    await eventRef.update({
      syncedWithMetricool: true,
      metricoolId,
      plataforma: network,
      status: "programado",
      syncedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      metricoolId,
      message: "Post creado y sincronizado exitosamente",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en create-post API:", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    let status = 500;
    if (message.includes("401") || message.includes("Unauthorized")) {
      status = 401;
    } else if (message.includes("403") || message.includes("Forbidden")) {
      status = 403;
    } else if (message.includes("404") || message.includes("Not Found")) {
      status = 404;
    }

    return NextResponse.json(
      {
        error: message,
        details:
          "Error al sincronizar con Metricool. Verifica la configuración de la API.",
      },
      { status }
    );
  }
}
