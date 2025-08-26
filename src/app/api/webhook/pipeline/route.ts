// src/app/api/webhook/pipeline/route.ts
import { NextResponse } from "next/server";
import { adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 añadido

interface WebhookBody {
  id?: string;
  projectId?: string;
  status?: string;
  outputUrl?: string;
  outputDuration?: number;
  model?: string;
}

interface UpdateData {
  status: string;
  updatedAt: FirebaseFirestore.Timestamp;
  downloadUrl?: string;
  duration?: number | null;
  model?: string | null;
  completedAt?: FirebaseFirestore.Timestamp;
  submagicProjectId?: string;
}

function getBaseUrl() {
  return process.env.NODE_ENV === "development"
    ? (process.env.NGROK_URL || "http://localhost:3000").replace(/\/$/, "")
    : (process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://app.viralizalo.ai").replace(/\/$/, "");
}

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";
  const idem = crypto.randomUUID();

  try {
    const url = new URL(req.url);
    const { uid } = Object.fromEntries(url.searchParams);
    if (!uid) {
      return NextResponse.json({ error: "UID requerido" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || ""; 
    const body = (await req.json()) as WebhookBody;
    console.log("🎤 Webhook lipsync recibido:", body);

    const projectId = body.id || body.projectId;
    if (!projectId) {
      return NextResponse.json(
        { error: "ID de proyecto no encontrado" },
        { status: 400 }
      );
    }

    const lipsyncRef = adminDB
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .doc(projectId);

    const baseUrl = getBaseUrl();
    const usageUrl = `${baseUrl}/api/billing/usage`;

    // 📊 evento genérico de recepción
    await gaServerEvent("pipeline_webhook_received", {
      uid,
      projectId,
      status: body.status ?? "unknown",
      simulated: simulate,
    });

    // 🔁 RAMA A: SIMULACIÓN
    if (simulate) {
      const fakeData: UpdateData = {
        status: "completed",
        updatedAt: adminTimestamp.now(),
        downloadUrl: "https://fake.local/video.mp4",
        duration: 42,
        model: "lipsync-2",
        completedAt: adminTimestamp.now(),
      };

      await lipsyncRef.set(fakeData, { merge: true });
      console.log("🟢 Webhook simulado guardado:", fakeData);

      await gaServerEvent("pipeline_completed", {
        uid,
        projectId,
        simulated: true,
        duration: 42,
      });

      // ⚡ Cobrar uso de edición (simulación)
      try {
        const usageRes = await fetch(usageUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            "X-Idempotency-Key": idem,
          },
          body: JSON.stringify({ kind: "edit", quantity: 1, idem }),
        });
        const usage = await usageRes.json().catch(() => ({}));
        if (!usageRes.ok || usage.ok !== true) {
          console.error("❌ Error registrando uso edit (simulado):", usage);
          await gaServerEvent("billing_edit_failed", { uid, simulated: true, usage });
        } else {
          await gaServerEvent("billing_edit_success", { uid, simulated: true });
        }
      } catch (err) {
        console.error("⚠️ Error llamando a /api/billing/usage (sim):", err);
        await gaServerEvent("billing_edit_failed", { uid, simulated: true, reason: String(err) });
      }

      // 👉 Encadenar simulación de Submagic
      const submagicPayload = {
        projectId: `submagic_${Date.now()}`,
        status: "completed",
        title: "Video Submagic Simulado",
        downloadUrl: "https://fake.local/video-submagic.mp4",
        duration: 30,
        completedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      await fetch(`${baseUrl}/api/webhook/submagic?uid=${uid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(submagicPayload),
      }).catch((err) => {
        console.error("❌ Error disparando webhook submagic simulado:", err);
        gaServerEvent("submagic_error_from_pipeline", { uid, simulated: true, reason: String(err) });
      });

      await gaServerEvent("submagic_triggered_from_pipeline", { uid, simulated: true });

      return NextResponse.json({ ok: true, simulated: true });
    }

    // 🔁 RAMA B: REAL
    const updateData: UpdateData = {
      status: body.status?.toLowerCase() || "unknown",
      updatedAt: adminTimestamp.now(),
    };

    if (body.status?.toLowerCase() === "completed" && body.outputUrl) {
      updateData.downloadUrl = body.outputUrl;
      updateData.duration = body.outputDuration ?? null;
      updateData.model = body.model ?? null;
      updateData.completedAt = adminTimestamp.now();

      await gaServerEvent("pipeline_completed", {
        uid,
        projectId,
        simulated: false,
        duration: updateData.duration,
      });

      const snap = await lipsyncRef.get();
      if (snap.exists) {
        const docData = snap.data() || {};
        const { subLang, template, email } = docData;

        if (email) {
          try {
            const webhookUrl = `${baseUrl}/api/webhook/submagic?uid=${uid}`;
            console.log("🚀 Enviando a Submagic con webhook:", webhookUrl);

            const submagicRes = await fetch(
              "https://api.submagic.co/v1/projects",
              {
                method: "POST",
                headers: {
                  "x-api-key": process.env.SUBMAGIC_API_KEY!,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  title: `Lipsync Edit - ${new Date().toLocaleString()}`,
                  language: subLang || "es",
                  videoUrl: body.outputUrl,
                  templateName: template || undefined,
                  webhookUrl,
                  magicZooms: true,
                  magicBrolls: true,
                  magicBrollsPercentage: 70,
                }),
              }
            );

            const submagicData = await submagicRes.json();

            if (submagicRes.ok && submagicData?.id) {
              updateData.submagicProjectId = submagicData.id;
              console.log("✅ Guardado submagicProjectId:", submagicData.id);

              await lipsyncRef.set(
                { submagicProjectId: submagicData.id },
                { merge: true }
              );

              await gaServerEvent("submagic_triggered_from_pipeline", {
                uid,
                projectId,
                submagicProjectId: submagicData.id,
              });

              // ⚡ Cobrar uso de edición (real)
              try {
                const usageRes = await fetch(usageUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                    "X-Idempotency-Key": idem,
                  },
                  body: JSON.stringify({ kind: "edit", quantity: 1, idem }),
                });
                const usage = await usageRes.json().catch(() => ({}));
                if (!usageRes.ok || usage.ok !== true) {
                  console.error("❌ Error registrando uso edit:", usage);
                  await gaServerEvent("billing_edit_failed", { uid, simulated: false, usage });
                } else {
                  await gaServerEvent("billing_edit_success", { uid, simulated: false });
                }
              } catch (err) {
                console.error("⚠️ Error llamando a /api/billing/usage (real):", err);
                await gaServerEvent("billing_edit_failed", { uid, simulated: false, reason: String(err) });
              }
            } else {
              console.error("❌ Error en Submagic:", submagicData);
              await gaServerEvent("submagic_error_from_pipeline", { uid, simulated: false, response: submagicData });
            }
          } catch (err) {
            console.error("⚠️ Error interno llamando a Submagic:", err);
            await gaServerEvent("submagic_error_from_pipeline", { uid, simulated: false, reason: String(err) });
          }
        }
      }
    }

    await lipsyncRef.set(updateData, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("💥 Error en webhook lipsync:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    await gaServerEvent("pipeline_webhook_failed", { reason: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
