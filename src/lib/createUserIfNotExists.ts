import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export const createUserIfNotExists = async (user: {
  uid: string;
  email: string | null;
  name?: string | null;
}) => {
  if (!user.email) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      name: user.name || "",
      role: "client",
      createdAt: serverTimestamp(),
    });
    console.log("Nuevo usuario creado en Firestore ✅");
  }
};
