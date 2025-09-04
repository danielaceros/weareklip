import { auth } from "@/lib/firebase";

export async function checkIsAdmin(uid?: string): Promise<boolean> {
  const userId = uid ?? auth.currentUser?.uid;
  if (!userId) return false;

  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return false;

    const res = await fetch(`/api/firebase/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      console.error(`❌ Error ${res.status} al obtener usuario`);
      return false;
    }

    const user = await res.json();
    return user?.role === "admin";
  } catch (error) {
    console.error("❌ Error al verificar rol de admin:", error);
    return false;
  }
}

