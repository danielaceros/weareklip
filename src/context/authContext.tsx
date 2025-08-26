"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { identify, track } from "@/lib/analytics-events"; // 👈 GA4 helper

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      // 🔎 GA4: identifica usuario + evento de auth
      if (u) {
        identify(u.uid);
        track("login", { method: "firebase_auth" });
      } else {
        track("logout");
      }

      // Navegación automática básica
      const onLoginPage = pathname === "/login";
      const onDashboard = pathname?.startsWith("/dashboard");

      if (u && onLoginPage) {
        router.replace("/dashboard");
      } else if (!u && onDashboard) {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router, pathname]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
