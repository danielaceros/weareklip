// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { createUserIfNotExists } from "@/lib/createUserIfNotExists";
import { useT } from "@/lib/i18n";

export default function Home() {
  const router = useRouter();
  const t = useT();

  // Helper: traduce con fallback si la clave no existe
  const tf = (key: string, fallback: string) => {
    const s = t(key);
    return s === key ? fallback : s;
  };

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mapFirebaseError = (err: FirebaseError): string => {
    switch (err.code) {
      case "auth/invalid-email":
        return tf("auth.errors.invalidEmail", "Email inválido");
      case "auth/user-not-found":
      case "auth/invalid-credential":
        return tf("auth.errors.userNotFound", "Usuario no encontrado o contraseña incorrecta");
      case "auth/wrong-password":
        return tf("auth.errors.wrongPassword", "Contraseña incorrecta");
      case "auth/too-many-requests":
        return tf("auth.errors.tooManyRequests", "Demasiados intentos. Intenta más tarde.");
      case "auth/email-already-in-use":
        return tf("auth.errors.emailInUse", "Este email ya está en uso");
      case "auth/weak-password":
        return tf("auth.errors.weakPassword", "La contraseña es demasiado débil");
      case "auth/network-request-failed":
        return tf("auth.errors.network", "Error de red. Revisa tu conexión.");
      case "auth/popup-closed-by-user":
        return tf("auth.errors.popupClosed", "Cerraste la ventana de Google");
      case "auth/popup-blocked":
        return tf("auth.errors.popupBlocked", "El navegador bloqueó la ventana emergente");
      default:
        return tf("auth.errors.unknown", "Error desconocido");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      if (auth.currentUser) {
        await createUserIfNotExists(auth.currentUser);
      }
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        setError(mapFirebaseError(err));
      } else {
        setError(tf("auth.errors.unknown", "Error desconocido"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      if (auth.currentUser) {
        await createUserIfNotExists(auth.currentUser);
      }
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        setError(mapFirebaseError(err));
      } else {
        setError(tf("auth.errors.unknown", "Error desconocido"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) router.push("/dashboard");
    });
    return () => unsubscribe();
  }, [router]);

  const title = tf("auth.title", "Bienvenido/a a KLIP");
  const subtitle = tf("auth.subtitle", "🤖 Automatizamos TODO tu contenido en redes.");
  const emailPh = tf("auth.email", "Correo electrónico");
  const passPh = tf("auth.password", "Contraseña");
  const loadingTxt = tf("auth.loading", "Cargando...");
  const loginTxt = tf("auth.login", "Entrar");
  const registerTxt = tf("auth.register", "Registrarse");
  const orContinue = tf("auth.orContinue", "o continuar con");
  const googleTxt = tf("auth.google", "Google");
  const noAccount = tf("auth.noAccount", "¿No tienes cuenta?");
  const haveAccount = tf("auth.haveAccount", "¿Ya tienes cuenta?");
  const goRegister = tf("auth.goRegister", "Regístrate");
  const goLogin = tf("auth.goLogin", "Inicia sesión");

  return (
    <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
      <div className="absolute inset-0 overflow-hidden" />
      <div className="relative z-10 px-6 text-center max-w-lg">
        <h1 className="text-5xl font-extrabold leading-tight mb-4">{title}</h1>
        <p className="text-lg mb-8">{subtitle}</p>

        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="py-8 px-6">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                type="email"
                placeholder={emailPh}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                disabled={loading}
                aria-label={emailPh}
              />
              <Input
                type="password"
                placeholder={passPh}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                disabled={loading}
                aria-label={passPh}
                minLength={6}
              />

              {error && (
                <p className="text-red-500 text-sm" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? loadingTxt : isLogin ? loginTxt : registerTxt}
              </Button>
            </form>

            <div className="my-4 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">{orContinue}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-label={googleTxt}
            >
              <FcGoogle className="text-xl" />
              {googleTxt}
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? noAccount : haveAccount}{" "}
              <span
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 hover:underline cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setIsLogin(!isLogin);
                }}
              >
                {isLogin ? goRegister : goLogin}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
