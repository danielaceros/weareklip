// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

async function createSessionCookie(user: any) {
  const idToken = await user.getIdToken();
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const router = useRouter();

  const validate = (): boolean => {
    if (!email || !password) {
      toast.warning("Completa todos los campos");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warning("Email inválido");
      return false;
    }
    if (password.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres");
      return false;
    }
    return true;
  };

  const ensureUserDoc = async (uid: string, emailAddr: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      await fetch(`/api/firebase/users/${uid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid,
          email: emailAddr?.toLowerCase().trim() ?? "",
          role: "user",
        }),
      });
    } catch (err) {
      console.error("Error en ensureUserDoc:", err);
    }
  };

  const checkOnboardingNeeded = async (uid: string): Promise<boolean> => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return true;

      const clonesRes = await fetch(`/api/firebase/users/${uid}/clones`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const clones = await clonesRes.json();
      if (Array.isArray(clones) && clones.length > 0) return false;

      const voicesRes = await fetch(`/api/firebase/users/${uid}/voices`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const voices = await voicesRes.json();
      if (Array.isArray(voices) && voices.length > 0) return false;

      return true;
    } catch (err) {
      console.error("Error comprobando onboarding:", err);
      return true;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      let user;
      if (mode === "login") {
        const res = await signInWithEmailAndPassword(auth, email, password);
        user = res.user;
        await ensureUserDoc(user.uid, user.email || email);

        if (!user.emailVerified) {
          toast.warning("Debes verificar tu correo antes de acceder");
          return router.replace("/verify");
        }

        await createSessionCookie(user); // 🔑 crea cookie de sesión
        toast.success("¡Bienvenido!");
        const needsOnboarding = await checkOnboardingNeeded(user.uid);
        router.replace(needsOnboarding ? "/dashboard/onboarding" : "/dashboard");
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        user = res.user;

        await sendEmailVerification(user);
        toast.info("Hemos enviado un correo de verificación. Revisa tu bandeja.");
        await ensureUserDoc(user.uid, user.email || email);

        return router.replace("/verify");
      }
    } catch (err) {
      const message =
        (err as { code?: string }).code === "auth/invalid-credential"
          ? "Credenciales inválidas"
          : (err as Error).message;
      toast.error(message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      await ensureUserDoc(user.uid, user.email || "");

      // Google siempre da email verificado
      await createSessionCookie(user); // 🔑 crea cookie de sesión

      toast.success("Inicio de sesión con Google");
      const needsOnboarding = await checkOnboardingNeeded(user.uid);
      router.replace(needsOnboarding ? "/dashboard/onboarding" : "/dashboard");
    } catch {
      toast.error("No se pudo iniciar sesión con Google");
    } finally {
      setLoadingGoogle(false);
    }
  };

  const onResetPassword = async () => {
    if (!email) {
      toast.warning("Introduce tu correo para restablecer la contraseña");
      return;
    }
    setLoadingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Te hemos enviado un correo para restablecer tu contraseña");
    } catch {
      toast.error("No se pudo enviar el correo de recuperación");
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-neutral-900 text-white rounded-2xl shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-lg font-semibold">
            {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
          </CardTitle>
          <p className="text-sm text-neutral-400">
            Introduce tu correo electrónico para acceder a tu cuenta
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Correo electrónico</label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Contraseña</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={onResetPassword}
                    disabled={loadingReset}
                    className="text-sm text-neutral-400 hover:text-white"
                  >
                    {loadingReset ? "Enviando..." : "¿Has olvidado tu contraseña?"}
                  </button>
                )}
              </div>
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 bg-neutral-200 text-black hover:bg-neutral-300"
            >
              {loading
                ? "Cargando..."
                : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
            </Button>

            <Button
              type="button"
              onClick={onGoogle}
              disabled={loadingGoogle}
              className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
            >
              {loadingGoogle ? "Conectando..." : "Iniciar sesión con Google"}
            </Button>

            <button
              type="button"
              className={cn("mt-2 text-sm text-neutral-400 hover:text-white")}
              onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
            >
              {mode === "login"
                ? "¿No tienes una cuenta? Regístrate"
                : "¿Ya tienes una cuenta? Inicia sesión"}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
