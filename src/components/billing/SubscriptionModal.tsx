"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import EmbeddedCheckoutModal from "@/components/user/EmbeddedCheckoutModal";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export default function SubscriptionModal({
  open,
  onClose,
  message,
}: SubscriptionModalProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsub();
  }, []);

  if (!user?.email) return null;

  return (
    <EmbeddedCheckoutModal
      open={open}
      onClose={onClose}
      uid={user.uid} // 👈 pasamos uid del auth
      message={
        message ??
        "Tu suscripción está vencida o cancelada. Para seguir usando la plataforma, reactívala."
      }
    />
  );
}
