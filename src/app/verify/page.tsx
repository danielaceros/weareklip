"use client";

import { auth } from "@/lib/firebase";
import {
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

export default function VerifyPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const redirected = useRef(false);

  // 🔐 Detectar usuario y redirigir si ya está verificado
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.reload();
        setCurrentUser(user);

        if (user.emailVerified && !redirected.current) {
          redirected.current = true;
          toast.success("Tu correo ya está verificado ✅");
          router.replace("/dashboard");
        }
      } else {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // 🔄 Polling cada segundo para comprobar verificación
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      await currentUser.reload();
      if (currentUser.emailVerified && !redirected.current) {
        redirected.current = true;
        toast.success("¡Correo verificado con éxito!");
        router.replace("/dashboard");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser, router]);

  const resendEmail = async () => {
    if (!currentUser) {
      toast.error("No hay usuario autenticado.");
      return;
    }
    try {
      await sendEmailVerification(currentUser);
      toast.success("Correo de verificación enviado. Revisa tu bandeja 📩");
      setCooldown(30); // ⏳ cooldown de 30s
    } catch (err: any) {
      if (err.code === "auth/too-many-requests") {
        toast.error("Has solicitado demasiados correos. Espera unos minutos ⏳");
      } else {
        toast.error("No se pudo enviar el correo de verificación.");
      }
      console.error("Error al reenviar correo:", err);
    }
  };

  // 🔄 Reducir cooldown cada segundo
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const goToLogin = async () => {
    try {
      // 1️⃣ Elimina cookie del backend
      await fetch("/api/session", { method: "DELETE" });

      // 2️⃣ Cierra sesión Firebase client
      await signOut(auth);

      // 3️⃣ Redirige
      router.replace("/login");
    } catch {
      toast.error("No se pudo cerrar la sesión.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="bg-neutral-900 p-6 rounded-2xl text-white text-center max-w-md">
        <h1 className="text-xl font-bold mb-4">Verifica tu correo</h1>
        <p className="text-neutral-400 mb-6">
          Te hemos enviado un correo de verificación. Haz clic en el enlace para
          activar tu cuenta.
        </p>
        <div className="flex flex-col gap-4">
          <Button
            onClick={resendEmail}
            disabled={cooldown > 0}
            className="bg-neutral-200 text-black hover:bg-neutral-300 disabled:opacity-50"
          >
            {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar correo"}
          </Button>
          <Button onClick={goToLogin} variant="outline">
            Volver al login
          </Button>
        </div>
      </div>
    </main>
  );
}
