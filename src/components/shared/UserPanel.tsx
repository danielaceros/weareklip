"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

import UserProfile from "@/components/shared/UserProfile";
import SubscriptionInfo from "@/components/shared/Subinfo";
import ClonacionVideos from "@/components/shared/ClonacionVideos";

interface UserData {
  email: string;
  name?: string;
  instagramUser?: string;
  phone?: string;
  photoURL?: string;
}

interface CustomerData {
  name: string | null;
  email: string | null;
  phone: string | null;
  address?: {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postal_code?: string;
    state?: string;
  } | null;
  created?: string | null;
}

interface StripeSubscription {
  status: string;
  plan: string;
  current_period_end: number | null;
  amount: number | null;
  interval: string;
  currency: string;
  cancel_at_period_end: boolean;
  customer: CustomerData;
}

export default function UserPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [sub, setSub] = useState<StripeSubscription | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast.error("No autenticado", {
          description: "Inicia sesión para ver tu panel.",
        });
        setUserId(null);
        setUserData(null);
        setSub(null);
        return;
      }

      setUserId(user.uid);

      try {
        const token = await user.getIdToken();

        // 🔹 Cargar datos del usuario desde API CRUD
        const userRes = await fetch(`/api/firebase/users/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) throw new Error("No se pudo obtener el usuario");
        const userData = await userRes.json();
        setUserData(userData as UserData);
      } catch (err) {
        console.error("❌ Error cargando datos de usuario:", err);
        toast.error("Error cargando datos de usuario.");
      }

      try {
        setLoadingSub(true);
        const token = await user.getIdToken();
        const res = await fetch("/api/stripe/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("No se pudo obtener la suscripción");
        const data = await res.json();
        setSub(data);
      } catch (err) {
        console.error("❌ Error cargando suscripción:", err);
        toast.error("Error cargando suscripción.");
      } finally {
        setLoadingSub(false);
      }
    });

    return () => unsub();
  }, []);


  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">Mi Panel de Usuario</h1>

      <UserProfile userId={userId} userData={userData} setUserData={setUserData} />

      <SubscriptionInfo loading={loadingSub} subscription={sub} />

      {userId && <ClonacionVideos userId={userId} />}
    </div>
  );
}
