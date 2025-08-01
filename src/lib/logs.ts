import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LogActionParams {
  type: "guion" | "video" | "clonacion" | "tarea" | "sistema";
  action: string;
  uid: string;
  admin: string;
  targetId?: string;
  message: string;
}

export async function logAction({
  type,
  action,
  uid,
  admin,
  targetId,
  message
}: LogActionParams): Promise<void> {
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