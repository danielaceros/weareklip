"use client";

import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";

export default function DashboardHome() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsub();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">¡Hola, {user?.email}!</h1>
      <p className="text-muted-foreground">
        Bienvenido a tu panel. Desde aquí puedes crear pedidos, ver el estado de tu contenido y gestionar tus pagos.
      </p>
    </div>
  );
}
