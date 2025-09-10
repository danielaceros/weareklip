"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  fetchSignInMethodsForEmail, // 👈 NEW
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaGoogle } from "react-icons/fa";
import FractalBackground from "@/components/login/FractalBackground";
import NextImage from "next/image";

const ALLOWED_EMAIL_DOMAINS = [
  /* … tus dominios … */
];

async function createSessionCookie(user: any) {
  const idToken = await user.getIdToken();
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

async function ensureStripeCustomer(force = false) {
  const u = auth.currentUser;
  if (!u) return;
  const cacheKey = `postLoginDone:${u.uid}`;
  if (
    !force &&
    typeof window !== "undefined" &&
    sessionStorage.getItem(cacheKey) === "1"
  )
    return;
  const idToken = await u.getIdToken();
  try {
    const res = await fetch("/api/auth/post-login", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok && typeof window !== "undefined")
      sessionStorage.setItem(cacheKey, "1");
    else console.error("[post-login] failed:", res.status, await res.text());
  } catch (e) {
    console.error("[post-login] error:", e);
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  // 👇 Estado para el mensaje inline
  const [formError, setFormError] = useState<null | {
    title: string;
    detail?: string;
    cta?: "register" | "google" | "reset";
  }>(null);

  // 👇 Refs para resaltar botones
  const registerBtnRef = useRef<HTMLButtonElement>(null);
  const googleBtnRef = useRef<HTMLButtonElement>(null);

  const router = useRouter();

  const pulse = (el?: HTMLElement | null) => {
    if (!el) return;
    el.classList.add("ring-2", "ring-amber-400", "animate-pulse");
    setTimeout(
      () => el.classList.remove("ring-2", "ring-amber-400", "animate-pulse"),
      1600
    );
  };

  const validate = async (): Promise<boolean> => {
    if (!email || !password) {
      setFormError({ title: "Completa todos los campos" });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError({ title: "Email inválido" });
      return false;
    }
    if (password.length < 6) {
      setFormError({ title: "La contraseña debe tener al menos 6 caracteres" });
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
      const userRes = await fetch(`/api/firebase/users/${uid}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!userRes.ok) return true;
      const user = await userRes.json();
      if (user?.onboardingCompleted) return false;
      const [clonesRes, voicesRes] = await Promise.all([
        fetch(`/api/firebase/users/${uid}/clones`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/firebase/users/${uid}/voices`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      ]);
      if (!clonesRes.ok || !voicesRes.ok) return true;
      const clones = (await clonesRes.json()).filter((c: any) => !!c?.url);
      const voices = (await voicesRes.json()).filter((v: any) => !!v?.voice_id);
      return !(clones.length > 0 && voices.length > 0);
    } catch (err) {
      console.error("Error comprobando onboarding:", err);
      return true;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!(await validate())) return;

    setLoading(true);
    try {
      const emailLower = email.trim().toLowerCase();

      if (mode === "login") {
        // 1) Intentar login directo (como antes)
        try {
          const res = await signInWithEmailAndPassword(
            auth,
            emailLower,
            password
          );
          const user = res.user;

          await ensureUserDoc(user.uid, user.email || email);
          if (!user.emailVerified) {
            toast.warning("Debes verificar tu correo antes de acceder");
            return router.replace("/verify");
          }

          await createSessionCookie(user);
          await ensureStripeCustomer();

          const needsOnboarding = await checkOnboardingNeeded(user.uid);
          toast.success("¡Bienvenido!");
          return router.replace(needsOnboarding ? "/onboarding" : "/dashboard");
        } catch (err: any) {
          // 2) Si falla, diagnosticamos y damos feedback claro
          const code = err?.code || "";
          // Miramos cómo está esa dirección en Firebase (solo ahora)
          let methods: string[] = [];
          try {
            methods = await fetchSignInMethodsForEmail(auth, emailLower);
          } catch {}

          // a) Cuenta solo con Google
          if (!methods.includes("password") && methods.includes("google.com")) {
            setFormError({
              title: "Tu cuenta está vinculada a Google.",
              detail: "Pulsa el botón “Iniciar sesión con Google”.",
              cta: "google",
            });
            pulse(googleBtnRef.current);
            return;
          }

          // b) No hay cuenta
          if (code === "auth/user-not-found" || methods.length === 0) {
            setFormError({
              title: "No encontramos una cuenta con ese correo.",
              detail: "Si aún no te has registrado, crea tu cuenta ahora.",
              cta: "register",
            });
            pulse(registerBtnRef.current);
            return;
          }

          // c) Credenciales inválidas (password incorrecta)
          if (
            code === "auth/wrong-password" ||
            code === "auth/invalid-credential" ||
            code === "auth/invalid-login-credentials"
          ) {
            setFormError({
              title: "Correo o contraseña incorrectos.",
              detail: "Si no recuerdas tu contraseña puedes restablecerla.",
              cta: "reset",
            });
            return;
          }

          // d) Otros casos
          if (code === "auth/too-many-requests") {
            setFormError({
              title:
                "Demasiados intentos. Espera unos minutos o restablece tu contraseña.",
              cta: "reset",
            });
          } else {
            setFormError({
              title: "No se pudo procesar tu solicitud. Inténtalo de nuevo.",
            });
          }
        }
      } else {
        // REGISTER
        const methods = await fetchSignInMethodsForEmail(auth, emailLower);
        if (methods.includes("password") || methods.includes("google.com")) {
          setFormError({
            title: "Este correo ya está registrado.",
            detail: methods.includes("google.com")
              ? "Accede con el botón de Google."
              : "Inicia sesión con tu contraseña.",
          });
          if (methods.includes("google.com")) pulse(googleBtnRef.current);
          setMode("login");
          return;
        }

        const res = await createUserWithEmailAndPassword(
          auth,
          emailLower,
          password
        );
        const user = res.user;

        await sendEmailVerification(user);
        toast.info(
          "Hemos enviado un correo de verificación. Revisa tu bandeja."
        );
        await ensureUserDoc(user.uid, user.email || email);
        await ensureStripeCustomer(true);
        return router.replace("/verify");
      }
    } catch (err: any) {
      // 👇 Mensajes amables (sin exponer códigos de Firebase)
      const code = err?.code || "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setFormError({
          title: "Correo o contraseña incorrectos.",
          detail: "Si no recuerdas tu contraseña puedes restablecerla.",
          cta: "reset",
        });
      } else {
        setFormError({
          title: "No se pudo procesar tu solicitud. Inténtalo de nuevo.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoadingGoogle(true);
    setFormError(null);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      await ensureUserDoc(user.uid, user.email || "");
      await createSessionCookie(user);
      await ensureStripeCustomer();
      toast.success("Inicio de sesión con Google");
      const needsOnboarding = await checkOnboardingNeeded(user.uid);
      router.replace(needsOnboarding ? "/onboarding" : "/dashboard");
    } catch {
      setFormError({ title: "No se pudo iniciar sesión con Google." });
    } finally {
      setLoadingGoogle(false);
    }
  };

  const onResetPassword = async () => {
    if (!email) {
      setFormError({
        title: "Introduce tu correo para restablecer la contraseña",
      });
      return;
    }
    setLoadingReset(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      toast.success(
        "Te hemos enviado un correo para restablecer tu contraseña"
      );
    } catch {
      setFormError({ title: "No se pudo enviar el correo de recuperación" });
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black p-4">
      <Card className="z-10 w-full max-w-md bg-neutral-900 text-white rounded-2xl shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <NextImage
              src="/icons/bg.png"
              alt="Logo"
              width={300}
              height={100}
              className="mx-auto"
              priority
            />
          </div>
          <CardTitle className="text-lg font-semibold">
            {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
          </CardTitle>
          <p className="text-sm text-neutral-400">
            Introduce tu correo electrónico para acceder a tu cuenta
          </p>
        </CardHeader>

        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Correo electrónico</label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                }}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Contraseña</label>
                <button
                  type="button"
                  onClick={onResetPassword}
                  disabled={loadingReset}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <Input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormError(null);
                }}
                required
                minLength={6}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            {/* 👇 Mensaje descriptivo inline */}
            {formError && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-100 p-3 text-sm">
                <div className="font-medium">{formError.title}</div>
                {formError.detail && (
                  <div className="text-amber-200/90">{formError.detail}</div>
                )}

                {formError.cta === "register" && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        pulse(registerBtnRef.current);
                      }}
                      className="underline decoration-amber-300 underline-offset-4"
                    >
                      Crear cuenta
                    </button>
                  </div>
                )}

                {formError.cta === "google" && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => pulse(googleBtnRef.current)}
                      className="underline decoration-amber-300 underline-offset-4"
                    >
                      Usar “Iniciar sesión con Google”
                    </button>
                  </div>
                )}

                {formError.cta === "reset" && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={onResetPassword}
                      className="underline decoration-amber-300 underline-offset-4"
                    >
                      Restablecer contraseña
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-0">
              <Button
                type="submit"
                disabled={loading}
                className="mt-2 bg-neutral-200 text-black hover:bg-neutral-400"
              >
                {loading
                  ? "Cargando..."
                  : mode === "login"
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
              </Button>

              <Button
                type="button"
                ref={googleBtnRef}
                onClick={onGoogle}
                disabled={loadingGoogle}
                className="mt-4 flex items-center justify-center bg-neutral-700 text-white border-none rounded-md py-2 hover:bg-neutral-800 transition duration-300"
              >
                {loadingGoogle ? (
                  "Conectando..."
                ) : (
                  <>
                    <FaGoogle className="mr-2" /> Iniciar sesión con Google
                  </>
                )}
              </Button>
            </div>

            <button
              ref={registerBtnRef}
              type="button"
              className={cn("mt-2 text-sm text-neutral-400 hover:text-white")}
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
      <FractalBackground />
    </main>
  );
}
