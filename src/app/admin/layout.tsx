"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return router.push("/");

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists() || snap.data().role !== "admin") {
        return router.push("/");
      }

      setAllowed(true);
    };

    checkRole();
  }, [router]); // Agrega `router` como dependencia

  if (!allowed) return null;
  return <div className="p-6">{children}</div>;
}
