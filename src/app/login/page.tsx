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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaGoogle } from 'react-icons/fa'; // Icono de Google
import FractalBackground from "@/components/login/FractalBackground";
import NextImage from "next/image";

// Lista blanca de dominios
const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "company.com", "hotmail.com",
  "aol.com", "icloud.com", "protonmail.com", "zoho.com", "mail.com",
  "yandex.com", "gmx.com", "fastmail.com", "tutanota.com", "hushmail.com",
  "msn.com", "live.com", "comcast.net", "verizon.net", "sbcglobal.net",
  "charter.net", "cox.net", "btinternet.com", "sky.com", "blueyonder.co.uk",
  "virginmedia.com", "ntlworld.com", "talktalk.net", "orange.fr", "free.fr",
  "wanadoo.fr", "sfr.fr", "laposte.net", "yahoo.co.uk", "ymail.com", "mail.ru",
  "qq.com", "126.com", "163.com", "tencent.com", "zoho.in", "inbox.com",
  "mailinator.com", "tempmail.com", "guerrillamail.com", "maildrop.cc",
  "spamex.com", "trashmail.com", "spamgourmet.com", "dispostable.com",
  "tempmailaddress.com", "throwawaymail.com", "sharklasers.com", "anonbox.net",
  "getnada.com", "trashmail.io", "emailondeck.com", "10minutemail.com",
  "mailcatch.com", "tmpmail.org", "fakemailgenerator.com", "burnermail.io",
  "tempmailo.com", "jetable.org"
];

// Verifica si el dominio del correo electrónico está en la lista blanca
const isAllowedDomain = (email: string): boolean => {
  const domain = email.split('@')[1];
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
};

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

  const validate = async (): Promise<boolean> => {
    if (!email || !password) {
      toast.error("Completa todos los campos");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Email inválido");
      return false;
    }

    if (!isAllowedDomain(email)) {
      toast.warning("Este dominio de correo no está permitido");
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

      // 🔹 Leer el doc principal del usuario
      const userRes = await fetch(`/api/firebase/users/${uid}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!userRes.ok) throw new Error("No se pudo cargar el usuario");
      const user = await userRes.json();

      // 🔹 Condición explícita
      if (user?.onboardingCompleted) return false;

      // 🔹 Fallback: si tiene clones y voces ya creados, asumimos completado
      const [clonesRes, voicesRes] = await Promise.all([
        fetch(`/api/firebase/users/${uid}/clones`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/firebase/users/${uid}/voices`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      ]);

      const clones = (await clonesRes.json()).filter((c: any) => !!c?.url);
      const voices = (await voicesRes.json()).filter((v: any) => !!v?.voice_id);

      if (clones.length > 0 && voices.length > 0) {
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error comprobando onboarding:", err);
      return true; // fallback conservador
    }
  };


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!await validate()) return; // Esperar a que la validación se complete
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
        const needsOnboarding = await checkOnboardingNeeded(user.uid);
        toast.success("¡Bienvenido!", { style: { background: "green", color: "white" } });

        // ⚡ evita parpadeo: no renderices dashboard si necesita onboarding
        if (needsOnboarding) {
          await router.replace("/onboarding");
        } else {
          await router.replace("/dashboard");
        }
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
        (err as { code?: string }).code === "auth/email-already-in-use"
          ? "Este correo electrónico ya está registrado. Intenta con otro."
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
      router.replace(needsOnboarding ? "/onboarding" : "/dashboard");
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
      <Card className="z-10 w-full max-w-md bg-neutral-900 text-white rounded-2xl shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <NextImage
              src="/icons/bg.png"   // tu archivo en /public
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
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Contraseña</label>
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
              onClick={onGoogle}
              disabled={loadingGoogle}
              className="mt-4 flex items-center justify-center bg-neutral-700 text-white border-none rounded-md py-2 hover:bg-neutral-800 transition duration-300"
            >
              {loadingGoogle ? "Conectando..." : <>
                <FaGoogle className="mr-2" /> Iniciar sesión con Google
              </>}
            </Button>
            </div>
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
      <FractalBackground />
    </main>
  );
}
