"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "@/lib/firebase"
import { createUserIfNotExists } from "@/lib/createUserIfNotExists"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FcGoogle } from "react-icons/fc"
import { toast } from "sonner"

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "El correo electrónico no es válido.",
  "auth/user-not-found": "No existe una cuenta con este correo.",
  "auth/wrong-password": "La contraseña es incorrecta.",
  "auth/email-already-in-use": "Este correo ya está registrado.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Intenta más tarde.",
  "auth/popup-closed-by-user": "Se cerró la ventana emergente antes de completar el inicio de sesión.",
  "auth/network-request-failed": "Error de red. Revisa tu conexión.",
}

function getErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return ERROR_MESSAGES[error.code] || `Error: ${error.message}`
  }
  return "Error desconocido. Intenta nuevamente."
}

export default function Home() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    if (!email || !password) {
      toast.warning("Completa todos los campos.")
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.warning("Introduce un correo válido.")
      return false
    }

    if (password.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres.")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password)
        toast.success("Inicio de sesión exitoso")
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
        toast.success("Cuenta creada correctamente")
      }

      await createUserIfNotExists(auth.currentUser!)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const provider = new GoogleAuthProvider()

    try {
      await signInWithPopup(auth, provider)
      await createUserIfNotExists(auth.currentUser!)
      toast.success("Inicio de sesión con Google exitoso")
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) router.push("/dashboard")
    })
    return () => unsubscribe()
  }, [router])

  return (
    <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
      <div className="absolute inset-0 overflow-hidden" />

      <div className="relative z-10 px-6 text-center max-w-lg">
        <h1 className="text-5xl font-extrabold leading-tight mb-4">
          {isLogin ? "Bienvenido/a a KLIP" : "Crea tu cuenta en KLIP"}
        </h1>
        <p className="text-lg mb-8">🤖 Automatizamos TODO tu contenido en redes.</p>

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

              <Button
                type="submit"
                className={`w-full ${loading ? "animate-pulse" : ""}`}
                disabled={loading}
              >
                {loading
                  ? "Procesando..."
                  : isLogin
                  ? "Entrar"
                  : "Registrarse"}
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
              disabled={loading}
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
  )
}
