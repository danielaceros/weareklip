// src/app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import AuthForm from "@/components/shared/auth/authform";
import GoogleLoginButton from "@/components/shared/auth/googleloginbutton";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Si ya hay sesión, vete al dashboard
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) router.replace("/dashboard");
    });
    return () => unsub();
  }, [router]);

  const createOrUpdateUserInFirestore = async (user: User) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: (user.email || "").toLowerCase().trim(),
        name: "",
        role: "client",
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        { email: (user.email || "").toLowerCase().trim() },
        { merge: true }
      );
    }
  };

  const validateForm = () => {
    if (!email || !password) {
      toast.warning(t("login.form.completeAll"));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warning(t("login.form.invalidEmail"));
      return false;
    }
    if (password.length < 6) {
      toast.warning(t("login.form.weakPassword"));
      return false;
    }
    return true;
  };

  const mapFirebaseError = (err: FirebaseError) => {
    const code = err.code;
    if (code === "auth/invalid-email") return t("login.firebase.invalidEmail");
    if (code === "auth/user-not-found" || code === "auth/invalid-credential")
      return t("login.firebase.userNotFound");
    if (code === "auth/wrong-password")
      return t("login.firebase.wrongPassword");
    if (code === "auth/email-already-in-use")
      return t("login.firebase.emailInUse");
    if (code === "auth/weak-password") return t("login.firebase.weakPassword");
    if (code === "auth/too-many-requests") return t("login.firebase.tooMany");
    return t("common.unknown");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoadingEmail(true);
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await createOrUpdateUserInFirestore(cred.user);
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await createOrUpdateUserInFirestore(cred.user);
      }
      // la redirección principal la hace onAuthStateChanged; forzamos por si acaso
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof FirebaseError) {
        toast.error(mapFirebaseError(err));
      } else {
        toast.error(t("common.unknown"));
      }
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await createOrUpdateUserInFirestore(cred.user);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof FirebaseError) {
        toast.error(mapFirebaseError(err));
      } else {
        toast.error(t("common.unknown"));
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
      <div className="relative z-10 px-6 text-center max-w-lg">
        <h1 className="text-5xl font-extrabold leading-tight mb-4">
          {isLogin ? t("login.titleLogin") : t("login.titleRegister")}
        </h1>
        <p className="text-lg mb-8">{t("login.subtitle")}</p>

        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="py-8 px-6">
            <AuthForm
              email={email}
              password={password}
              setEmail={setEmail}
              setPassword={setPassword}
              handleSubmit={handleSubmit}
              isLogin={isLogin}
              loading={loadingEmail}
              toggleMode={() => setIsLogin(!isLogin)}
            />

            <GoogleLoginButton
              handleGoogleLogin={handleGoogleLogin}
              loading={loadingGoogle}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
