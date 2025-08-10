"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { AdminSidebar } from "@/components/shared/adminsidebar";
import { NotificationFloatingWrapper } from "@/components/shared/floating";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return router.push("/");

      try {
        const adminsSnap = await getDocs(collection(db, "admin"));
        const isAdmin = adminsSnap.docs.some(
          (doc) =>
            doc.data()?.email?.toLowerCase() === user.email?.toLowerCase()
        );

        if (!isAdmin) return router.push("/");
        setAllowed(true);
      } catch (error) {
        console.error("Error verificando admin:", error);
        router.push("/");
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (checking || !allowed) return null;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-muted p-6">{children}</main>
      <NotificationFloatingWrapper />
    </div>
  );
}
