"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { FirebaseError } from "firebase/app";
import { createUserIfNotExists } from "@/lib/createUserIfNotExists";

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Función para manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      await createUserIfNotExists(auth.currentUser!);
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        setError(err.message);
      } else {
        setError("Error desconocido");
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para manejar el login con Google
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      await createUserIfNotExists(auth.currentUser!);
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        setError(err.message);
      } else {
        setError("Error desconocido");
      }
    }
  };

  // Redirigir al dashboard si el usuario ya está autenticado
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        router.push("/dashboard");  // Redirige al dashboard si el usuario está logueado
      }
    });

    return () => unsubscribe();  // Limpiar el listener cuando se desmonte el componente
  }, [router]);

  return (
    <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
      <div className="absolute inset-0 overflow-hidden">
      </div>

      <div className="relative z-10 px-6 text-center max-w-lg">
        <h1 className="text-5xl font-extrabold leading-tight mb-4">
          {isLogin ? "Bienvenido/a a KLIP" : "Bienvenido/a a KLIP"}
        </h1>
        <p className="text-lg mb-8">
          {isLogin
            ? "🤖 Automatizamos TODO tu contenido en redes."
            : "🤖 Automatizamos TODO tu contenido en redes."}
        </p>

        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="py-8 px-6">
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Cargando..." : isLogin ? "Entrar" : "Registrarse"}
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
    </main>
  );
}
