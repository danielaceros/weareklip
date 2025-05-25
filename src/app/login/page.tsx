"use client";
import { createUserIfNotExists } from "@/lib/createUserIfNotExists";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      await createUserIfNotExists(auth.currentUser!);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      await createUserIfNotExists(auth.currentUser!);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="py-8 px-6">
          <h1 className="text-3xl font-bold text-center mb-6">
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button type="submit" className="w-full">
              {isLogin ? "Entrar" : "Registrarse"}
            </Button>
          </form>

          <div className="my-4 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">o continuar con</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleLogin}
          >
            <FcGoogle className="text-xl" />
            Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <span
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:underline cursor-pointer"
            >
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
