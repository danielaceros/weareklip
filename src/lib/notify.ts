// src/lib/notify.ts
import { adminDB } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

export async function notifyPush(
  uid: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  // 1) lee tokens activos del usuario
  const snap = await adminDB.collection("users").doc(uid).get();
  const tokensObj = snap.get("fcmTokens") || {};
  const tokens = Object.keys(tokensObj).filter((t) => tokensObj[t]?.active !== false);

  if (!tokens.length) return { sent: 0, failed: 0 };

  // 2) envía multicast
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    webpush: { notification: { icon: "/vercel.svg" } },   // cambia si tienes /icon-192.png
    android: { notification: { icon: "/vercel.svg" } },
  });

  // 3) desactiva tokens inválidos (tipado seguro)
  const invalid: string[] = [];
  res.responses.forEach((resp, i) => {
    if (resp.success) return;
    const err: any = (resp as any).error; // evitar problemas de typing
    const code = String(err?.code || err?.errorInfo?.code || err?.message || "");
    if (
      /registration-token-not-registered/i.test(code) ||
      /invalid-argument/i.test(code)
    ) {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length) {
    const updates: Record<string, any> = {};
    for (const t of invalid) updates[`fcmTokens.${t}.active`] = false;
    await adminDB.collection("users").doc(uid).set(updates, { merge: true });
  }

  return { sent: res.successCount, failed: res.failureCount };
}

