"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { setUserIdentity, track } from "@/lib/analytics-events";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        setUserIdentity(u.uid);
        track("auth_signed_in", { method: "firebase" });
      } else {
        track("auth_signed_out");
      }

      // Navegación automática básica
      const onLoginPage = pathname === "/login";
      const onDashboard = pathname?.startsWith("/dashboard");
      if (u && onLoginPage) {
        track("nav_redirect", { from: "/login", to: "/dashboard" });
        router.replace("/dashboard");
      } else if (!u && onDashboard) {
        track("nav_redirect", { from: pathname, to: "/login" });
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router, pathname]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

