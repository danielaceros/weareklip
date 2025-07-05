"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  User,
  ConfirmationResult,
} from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth, db } from "@/lib/firebase"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FcGoogle } from "react-icons/fc"
import { toast } from "sonner"
import PhoneInput from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "El correo electrónico no es válido.",
  "auth/user-not-found": "No existe una cuenta con este correo.",
  "auth/wrong-password": "La contraseña es incorrecta.",
  "auth/email-already-in-use": "Este correo ya está registrado.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Intenta más tarde.",
  "auth/popup-closed-by-user": "Se cerró la ventana emergente antes de completar el inicio de sesión.",
  "auth/network-request-failed": "Error de red. Revisa tu conexión.",
  "auth/invalid-verification-code": "Código de verificación inválido.",
  "auth/missing-verification-code": "Falta el código de verificación.",
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
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>()
  const [showVerification, setShowVerification] = useState(false)
  const [showAddPhone, setShowAddPhone] = useState(false)
  const [verificationCode, setVerificationCode] = useState<string[]>(["", "", "", "", "", ""])
  const confirmationResultRef = useRef<ConfirmationResult | null>(null)
  const pendingUserRef = useRef<User | null>(null)
  const [loading, setLoading] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          badge: "bottomleft",
          callback: () => {},
          "expired-callback": () => {
            toast.error("reCAPTCHA expiró, intenta nuevamente.")
          },
        })
      } catch (e) {
        console.warn("Error inicializando reCAPTCHA:", e)
      }
    }
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        delete window.recaptchaVerifier
      }
    }
  }, [])

  useEffect(() => {
    if (showVerification || showAddPhone) {
      requestAnimationFrame(() => {
        inputsRef.current[0]?.focus()
      })
    }
  }, [showVerification, showAddPhone])

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

  const sendOtpForLogin = async (user: User) => {
    setLoading(true)
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const phone = userDoc.exists() ? userDoc.data().phone : user.phoneNumber
      if (!phone) {
        toast.warning(
          "No tienes número de teléfono asociado. Por favor, añádelo para activar 2FA."
        )
        pendingUserRef.current = user
        setShowAddPhone(true)
        setLoading(false)
        return
      }
      pendingUserRef.current = user
      const appVerifier = window.recaptchaVerifier!
      confirmationResultRef.current = await signInWithPhoneNumber(auth, phone, appVerifier)
      setVerificationCode(["", "", "", "", "", ""])
      setShowVerification(true)
    } catch (error: unknown) {
      console.error("Error en sendOtpForLogin:", error)
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else {
        toast.error("Error al enviar OTP para 2FA.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        toast.success("Email y contraseña correctos. Verifica con código OTP.")
        await sendOtpForLogin(userCredential.user)
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        pendingUserRef.current = userCredential.user
        toast.success("Cuenta creada. Añade tu teléfono para activar 2FA.")
        setShowAddPhone(true)
      }
    } catch (error: unknown) {
      console.error("Error en handleSubmit:", error)
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else {
        toast.error("Error desconocido. Intenta nuevamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const onOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...verificationCode]
    newCode[index] = value.slice(-1)
    setVerificationCode(newCode)
    if (value && index < 5) inputsRef.current[index + 1]?.focus()
    if (!value && index > 0) inputsRef.current[index - 1]?.focus()
  }

  const onOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const verifyCodeAndFinalize = async () => {
    if (verificationCode.some((d) => d === "")) {
      toast.warning("Completa los 6 dígitos del código.")
      return
    }
    setLoading(true)
    try {
      if (!confirmationResultRef.current) {
        toast.error("No hay proceso de verificación activo.")
        setLoading(false)
        return
      }
      const code = verificationCode.join("")
      await confirmationResultRef.current.confirm(code)

      const currentUser = auth.currentUser
      if (!currentUser) {
        toast.error("No se pudo obtener usuario autenticado.")
        setLoading(false)
        return
      }

      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          uid: currentUser.uid,
          email: currentUser.email || "",
          phone: phoneNumber || "",
          name: "",
          role: "client",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      toast.success("Autenticación completada")
      setShowVerification(false)
      setShowAddPhone(false)
      pendingUserRef.current = null
      router.push("/dashboard")
    } catch (error: unknown) {
      console.error("Error al verificar OTP:", error)
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else {
        toast.error("Error desconocido. Intenta nuevamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const sendOtpToNewPhone = async () => {
    if (!phoneNumber) {
      toast.warning("Ingresa un número de teléfono válido.")
      return
    }
    setLoading(true)
    try {
      const appVerifier = window.recaptchaVerifier!
      confirmationResultRef.current = await signInWithPhoneNumber(auth, phoneNumber, appVerifier)
      setVerificationCode(["", "", "", "", "", ""])
      setShowAddPhone(false)
      setShowVerification(true)
    } catch (error: unknown) {
      console.error("Error al enviar OTP al nuevo teléfono:", error)
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else {
        toast.error("Error desconocido. Intenta nuevamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!window.recaptchaVerifier) {
      toast.error("reCAPTCHA no está listo, intenta recargar la página.")
      return
    }
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      toast.success("Inicio de sesión con Google exitoso. Verifica con código OTP.")
      await sendOtpForLogin(userCredential.user)
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else {
        toast.error("Error desconocido. Intenta nuevamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputsRef.current[index] = el
  }

  return (
    <>
      <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
        <div id="recaptcha-container"></div>

        <div className="relative z-10 px-6 text-center max-w-lg">
          <h1 className="text-5xl font-extrabold leading-tight mb-4">
            {isLogin ? "Bienvenido/a a KLIP" : "Empieza en KLIP"}
          </h1>
          <p className="text-lg mb-8">🤖 Automatizamos TODO tu contenido en redes.</p>

          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="py-8 px-6">
              {!showVerification && !showAddPhone ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                  <Input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    disabled={loading}
                  />

                  <Button
                    type="submit"
                    className={`w-full ${loading ? "animate-pulse" : ""}`}
                    disabled={loading}
                  >
                    {loading ? "Procesando..." : isLogin ? "Entrar" : "Registrarse"}
                  </Button>
                </form>
              ) : null}

              {!showVerification && !showAddPhone && (
                <>
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
                      onClick={() => {
                        setIsLogin(!isLogin)
                        setShowVerification(false)
                        setShowAddPhone(false)
                        setVerificationCode(["", "", "", "", "", ""])
                      }}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      {isLogin ? "Regístrate" : "Inicia sesión"}
                    </span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog
        open={showVerification}
        onOpenChange={(open) => {
          if (!loading) setShowVerification(open)
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby="otp-desc">
          <DialogHeader>
            <DialogTitle>Verifica tu teléfono</DialogTitle>
          </DialogHeader>

          <p id="otp-desc" className="mb-4">
            Ingresa el código de 6 dígitos que recibiste por SMS para verificar tu teléfono.
          </p>

          <div className="flex justify-center gap-2">
            {verificationCode.map((digit, i) => (
              <Input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => onOtpChange(i, e.target.value)}
                onKeyDown={(e) => onOtpKeyDown(e, i)}
                ref={setInputRef(i)}
                className="w-12 h-12 text-center text-2xl font-mono"
                autoFocus={i === 0}
                disabled={loading}
              />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              className={`flex-1 ${loading ? "animate-pulse" : ""}`}
              onClick={verifyCodeAndFinalize}
              disabled={loading || verificationCode.some((d) => d === "")}
            >
              {loading ? "Verificando..." : "Verificar código"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => !loading && setShowVerification(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAddPhone}
        onOpenChange={(open) => {
          if (!loading) setShowAddPhone(open)
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby="add-phone-desc">
          <DialogHeader>
            <DialogTitle>Agrega tu teléfono</DialogTitle>
          </DialogHeader>

          <p id="add-phone-desc" className="mb-4">
            Para activar 2FA, por favor añade tu número de teléfono y verifica con el código que
            recibirás.
          </p>

          <PhoneInput
            international
            defaultCountry="ES"
            value={phoneNumber}
            onChange={setPhoneNumber}
            placeholder="Número de teléfono"
            className="text-black rounded p-2 w-full mb-4"
            disabled={loading}
          />

          <div className="flex justify-center gap-2 mb-4">
            <Button
              className={`flex-1 ${loading ? "animate-pulse" : ""}`}
              onClick={sendOtpToNewPhone}
              disabled={loading || !phoneNumber}
            >
              {loading ? "Enviando OTP..." : "Enviar código"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => !loading && setShowAddPhone(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
