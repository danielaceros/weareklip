import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return false;

    const data = snap.data();
    return data.role === "admin";
  } catch (error) {
    console.error("❌ Error al verificar rol de admin:", error);
    return false;
  }
}
