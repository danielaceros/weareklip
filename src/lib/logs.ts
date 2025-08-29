import { User } from "firebase/auth";

export type LogType = "guion" | "video" | "clonacion" | "tarea" | "sistema";

export interface Log {
  id: string;
  type: LogType;
  action: string;
  uid: string;
  userName?: string;
  admin: string;
  message: string;
  timestamp: string; // ISO string desde backend
  readByClient?: boolean;
  readByAdmin?: boolean;
}

// Suscribirse a logs no leídos (simulado con polling, porque onSnapshot no sirve ya)
export async function fetchUnreadLogs(user: User, isAdmin: boolean): Promise<Log[]> {
  const idToken = await user.getIdToken();

  const url = isAdmin
    ? `/api/firebase/logs?filter=unreadAdmin`
    : `/api/firebase/logs?filter=unreadClient&uid=${user.uid}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) throw new Error("Error cargando logs");

  return res.json();
}

// Marcar varios logs como leídos
export async function markLogsAsRead(user: User, logs: Log[], isAdmin: boolean) {
  const idToken = await user.getIdToken();
  const field = isAdmin ? "readByAdmin" : "readByClient";

  await Promise.all(
    logs.map((log) =>
      fetch(`/api/firebase/logs/${log.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ [field]: true }),
      })
    )
  );
}

// Marcar un único log
export async function markSingleLogAsRead(user: User, log: Log, isAdmin: boolean) {
  const idToken = await user.getIdToken();
  const field = isAdmin ? "readByAdmin" : "readByClient";

  await fetch(`/api/firebase/logs/${log.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ [field]: true }),
  });
}

// Añadir nuevo log
export async function logAction(
  user: User,
  {
    type,
    action,
    uid,
    admin,
    targetId,
    message,
  }: {
    type: LogType;
    action: string;
    uid: string;
    admin: string;
    targetId?: string;
    message: string;
  }
): Promise<void> {
  const idToken = await user.getIdToken();

  await fetch(`/api/firebase/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      type,
      action,
      uid,
      admin,
      targetId: targetId || null,
      message,
      readByClient: false,
      readByAdmin: false,
      timestamp: new Date().toISOString(),
    }),
  });
}
