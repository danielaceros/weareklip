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
} from "firebase/auth";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  serverTimestamp, 
  setDoc 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          uid,
          email: emailAddr.toLowerCase().trim(),
          role: "user",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };

  const checkOnboardingNeeded = async (uid: string): Promise<boolean> => {
    try {
      const clonacionSnap = await getDocs(collection(db, "users", uid, "clonacion"));
      if (!clonacionSnap.empty) return false;

      const voicesSnap = await getDocs(collection(db, "users", uid, "voices"));
      if (!voicesSnap.empty) return false;

      return true; // Si no hay ni vídeos ni voces
    } catch (err) {
      console.error("Error comprobando clonación/voces:", err);
      return true; // fallback: mejor mandarlo a onboarding
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
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        user = res.user;
        await ensureUserDoc(user.uid, user.email || email);
      }

      toast.success(mode === "login" ? "¡Bienvenido!" : "Cuenta creada");

      const needsOnboarding = await checkOnboardingNeeded(user.uid);
      router.replace(needsOnboarding ? "/dashboard/onboarding" : "/dashboard");
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
    } catch (err) {
      toast.error("No se pudo enviar el correo de recuperación");
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-2 sm:px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg bg-neutral-900 text-white rounded-2xl shadow-lg px-4 sm:px-6 md:px-8 py-6 sm:py-8">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-lg sm:text-xl md:text-2xl font-semibold">
            {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
          </CardTitle>
          <p className="text-sm sm:text-base text-neutral-400">
            Introduce tu correo electrónico para acceder a tu cuenta
          </p>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[80vh] sm:max-h-none">
          <form
            className="grid gap-4"
            onSubmit={onSubmit}
            aria-label="Formulario de acceso"
          >
            <div className="grid gap-2">
              <label className="text-sm sm:text-base font-medium">Correo electrónico</label>
              <Input
                type="email"
                name="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 text-sm sm:text-base min-h-[44px]"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm sm:text-base font-medium">Contraseña</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={onResetPassword}
                    disabled={loadingReset}
                    className="text-xs sm:text-sm text-neutral-400 hover:text-white"
                  >
                    {loadingReset ? "Enviando..." : "¿Has olvidado tu contraseña?"}
                  </button>
                )}
              </div>
              <Input
                type="password"
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 text-sm sm:text-base min-h-[44px]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-4 mt-2 bg-neutral-200 text-black hover:bg-neutral-300 text-sm sm:text-base font-medium min-h-[44px]"
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
              className="w-full py-3 sm:py-4 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-sm sm:text-base font-medium min-h-[44px]"
            >
              {loadingGoogle ? "Conectando..." : "Iniciar sesión con Google"}
            </Button>

            <button
              type="button"
              className="mt-2 text-xs sm:text-sm md:text-base text-neutral-400 hover:text-white"
              onClick={() =>
                setMode((m) => (m === "login" ? "register" : "login"))
              }
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
