import type { User } from "firebase/auth";

export const createUserIfNotExists = async (user: User) => {
  if (!user?.uid || !user?.email) return;

  try {
    const idToken = await user.getIdToken(); // ✅ ahora sí existe
    const res = await fetch(`/api/firebase/users/${user.uid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email.toLowerCase().trim(),
        name: user.displayName?.trim() || "",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error creando usuario (${res.status}): ${errorText}`);
    }

    console.log("✅ Usuario creado/actualizado vía API CRUD:", user.email);
  } catch (err) {
    console.error("❌ Error en createUserIfNotExists (API CRUD):", err);
    throw err;
  }
};

