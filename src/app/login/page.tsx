// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "login") {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(user.uid, user.email || email);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(user.uid, user.email || email);
      }
      toast.success(mode === "login" ? "¡Bienvenido!" : "Cuenta creada");
      router.replace("/dashboard");
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
      router.replace("/dashboard");
    } catch {
      toast.error("No se pudo iniciar sesión con Google");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {mode === "login" ? "Entrar a KLIP" : "Crea tu cuenta"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={onSubmit}
            aria-label="Formulario de acceso"
          >
            <label className="grid gap-1">
              <span className="sr-only">Email</span>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="sr-only">Contraseña</span>
              <Input
                type="password"
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Contraseña"
                required
                minLength={6}
              />
            </label>

            <Button type="submit" className="mt-2" disabled={loading}>
              {loading
                ? "Cargando..."
                : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onGoogle}
              disabled={loadingGoogle}
            >
              {loadingGoogle ? "Conectando..." : "Continuar con Google"}
            </Button>

            <button
              type="button"
              className={cn(
                "mt-2 text-sm text-muted-foreground underline underline-offset-4"
              )}
              onClick={() =>
                setMode((m) => (m === "login" ? "register" : "login"))
              }
            >
              {mode === "login"
                ? "¿No tienes cuenta? Regístrate"
                : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
