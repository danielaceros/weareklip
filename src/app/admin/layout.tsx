"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();
  const routerRef = useRef(router);  // Use useRef to store router

  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return routerRef.current.push("/");  // Use routerRef

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists() || snap.data().role !== "admin") {
        return routerRef.current.push("/");  // Use routerRef
      }

      setAllowed(true);
    };

    checkRole();
  }, []);  // Empty dependency array to avoid repeated effect

  if (!allowed) return null;
  return <div className="p-6">{children}</div>;
}
