import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type LogType = "guion" | "video" | "clonacion" | "tarea" | "sistema";

export interface Log {
  id: string;
  type: LogType;
  action: string;
  uid: string;
  userName?: string;
  admin: string;
  message: string;
  timestamp: Timestamp;
  readByClient?: boolean;
  readByAdmin?: boolean;
}

// ✅ Suscribirse a logs no leídos
export function subscribeToUnreadLogs(
  uid: string,
  isAdmin: boolean,
  callback: (logs: Log[]) => void
) {
  const base = collection(db, "logs");

  const q = isAdmin
    ? query(
        base,
        where("readByAdmin", "==", false),
        orderBy("timestamp", "desc")
      )
    : query(
        base,
        where("uid", "==", uid),
        where("readByClient", "==", false),
        orderBy("timestamp", "desc")
      );

  return onSnapshot(q, (snapshot) => {
    const logs: Log[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Log, "id">),
    }));
    callback(logs);
  });
}

// ✅ Marcar varios logs como leídos
export async function markLogsAsRead(logs: Log[], isAdmin: boolean) {
  const field = isAdmin ? "readByAdmin" : "readByClient";

  const updates = logs.map((log) =>
    updateDoc(doc(db, "logs", log.id), {
      [field]: true,
    })
  );

  await Promise.all(updates);
}

// ✅ Marcar un único log como leído
export async function markSingleLogAsRead(log: Log, isAdmin: boolean) {
  const field = isAdmin ? "readByAdmin" : "readByClient";

  await updateDoc(doc(db, "logs", log.id), {
    [field]: true,
  });
}

// ✅ Añadir nuevo log
export async function logAction({
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
}): Promise<void> {
  try {
    await addDoc(collection(db, "logs"), {
      type,
      action,
      uid,
      admin,
      targetId: targetId || null,
      message,
      readByClient: false,
      readByAdmin: false,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging action:", error);
    throw new Error("Failed to log action");
  }
}
