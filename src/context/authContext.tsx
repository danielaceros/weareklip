"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

// Define el contexto de autenticación
const AuthContext = createContext<User | null>(null);

// Proveedor de contexto de autenticación
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Si el usuario no está autenticado, redirige al login
      if (!currentUser) {
        router.push("/login");
      }
    });

    return () => unsub();
  }, [router]);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
};

// Hook para usar el contexto de autenticación en cualquier parte de la app
export const useAuth = () => {
  return useContext(AuthContext);
};
