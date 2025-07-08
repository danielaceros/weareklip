"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getMultiFactorResolver,
  MultiFactorResolver,
  MultiFactorError,
  sendEmailVerification
} from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth, db } from "@/lib/firebase"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FcGoogle } from "react-icons/fc"
import { toast } from "sonner"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

import PhoneInput from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { isValidPhoneNumber } from "react-phone-number-input"

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
  "auth/multi-factor-auth-required": "Se requiere autenticación multifactor.",
}

function getErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return ERROR_MESSAGES[error.code] || `Error: ${error.message}`
  }
  return "Error desconocido. Intenta nuevamente."
}

async function createOrUpdateUserInFirestore(user: User) {
  try {
    const userDocRef = doc(db, "users", user.uid)
    const userDoc = await getDoc(userDocRef)

    if (!userDoc.exists()) {
      await setDoc(
        userDocRef,
        {
          uid: user.uid,
          email: user.email || "",
          name: "",
          role: "client",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )
    } else {
      await setDoc(
        userDocRef,
        {
          email: user.email || "",
        },
        { merge: true }
      )
    }
  } catch (error) {
    console.error("Error actualizando Firestore:", error)
    toast.error("Error interno. Intenta nuevamente más tarde.")
  }
}

export default function Home() {
  const router = useRouter()

  // States principales
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(undefined)
  const [verificationCode, setVerificationCode] = useState<string[]>(["", "", "", "", "", ""])
  const [showMfaDialog, setShowMfaDialog] = useState(false)
  const [showEnrollPhone, setShowEnrollPhone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false)
  const [recaptchaVisible, setRecaptchaVisible] = useState(false)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loadingMfa, setLoadingMfa] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Inicializar reCAPTCHA invisible, render solo una vez
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          setRecaptchaVisible(false) // Captcha resuelto sin challenge visual
        },
        "expired-callback": () => {
          toast.error("reCAPTCHA expiró, intenta nuevamente.")
          setRecaptchaVisible(false)
        },
        "error-callback": () => {
          toast.error("Error con reCAPTCHA. Intenta nuevamente.")
          setRecaptchaVisible(false)
        },
      })
      verifier.render().then(() => {
        window.recaptchaVerifier = verifier
      }).catch(err => {
        console.error("Error renderizando reCAPTCHA:", err)
        toast.error("Error inicializando seguridad. Intenta recargar.")
      })
    }
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        delete window.recaptchaVerifier
      }
    }
  }, [])

  // Manejo de inputs MFA (códigos)
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

  // Verificar código MFA para login
  const verifyMfaCode = async () => {
  if (verificationCode.some((d) => d === "")) {
    toast.warning("Completa los 6 dígitos del código.")
    return
  }
  if (!mfaResolver || !verificationId) {
    toast.error("No hay proceso de autenticación multifactor activo.")
    return
  }

  setLoadingMfa(true)
  try {
    const code = verificationCode.join("")
    const cred = PhoneAuthProvider.credential(verificationId, code)
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred)
    const userCredential = await mfaResolver.resolveSignIn(multiFactorAssertion)
    await createOrUpdateUserInFirestore(userCredential.user)

    toast.success("Autenticación multifactor completada")
    setShowMfaDialog(false)
    setVerificationCode(["", "", "", "", "", ""])
    setMfaResolver(null)
    setVerificationId(null)
    router.push("/dashboard")
  } catch (error) {
    console.error("Error verificando MFA:", error)
    toast.error(getErrorMessage(error))
  } finally {
    setLoadingMfa(false)
    setRecaptchaVisible(false)
  }
}

  // Enroll MFA para usuario nuevo con teléfono
  async function enrollMfaForUser(user: User, phone: string) {
    if (!phone || !isValidPhoneNumber(phone)) {
      toast.error("Ingresa un número de teléfono válido.")
      return
    }
    setLoading(true)
    try {
      setIsEnrollingMfa(true)
      const mfaSession = await multiFactor(user).getSession()
      const phoneInfoOptions = { phoneNumber: phone, session: mfaSession }
      const phoneAuthProvider = new PhoneAuthProvider(auth)

      setRecaptchaVisible(true) // Mostrar recaptcha para interacción

      const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, window.recaptchaVerifier!)
      setVerificationId(verificationId)
      setShowEnrollPhone(false)
      setShowMfaDialog(true)
      setMfaResolver(null)
    } catch (error) {
      console.error("Error inscribiendo MFA:", error)
      toast.error(getErrorMessage(error))
      setLoading(false)
      setIsEnrollingMfa(false)
      setRecaptchaVisible(false)
    }
  }

  // Completar inscripción MFA
  const completeEnrollMfa = async () => {
    if (verificationCode.some((d) => d === "")) {
      toast.warning("Completa los 6 dígitos del código.")
      return
    }
    if (!verificationId) {
      toast.error("No hay proceso de verificación activo.")
      return
    }
    setLoading(true)
    try {
      const code = verificationCode.join("")
      const cred = PhoneAuthProvider.credential(verificationId, code)
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred)
      const user = auth.currentUser
      if (!user) throw new Error("No hay usuario autenticado")

      await multiFactor(user).enroll(multiFactorAssertion, "Teléfono principal")
      toast.success("MFA inscrito correctamente")
      setShowEnrollPhone(false)
      setVerificationCode(["", "", "", "", "", ""])
      setIsEnrollingMfa(false)
      router.push("/dashboard")
    } catch (error) {
      console.error("Error completando inscripción MFA:", error)
      toast.error(getErrorMessage(error))
      setIsEnrollingMfa(false)
      setLoading(false)
    } finally {
      setRecaptchaVisible(false)
    }
  }

  // Comprobar si usuario ya tiene MFA, sino pedir teléfono
  async function checkAndEnrollMfaIfMissing(user: User) {
    try {
      const mfaUser = multiFactor(user)
      if (mfaUser.enrolledFactors.length === 0) {
        setShowEnrollPhone(true)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error verificando MFA usuario:", error)
      toast.error("Error de autenticación. Intenta nuevamente.")
      setLoading(false)
    }
  }

  // Validación del formulario login/registro
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

  // Registro con email+pass
  const handleRegister = async () => {
    if (!validateForm()) return
    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await createOrUpdateUserInFirestore(userCredential.user)
      toast.success("Cuenta creada correctamente")
      await checkAndEnrollMfaIfMissing(userCredential.user)
    } catch (error) {
      console.error("Error en registro:", error)
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  // Login con email+pass
  const handleLogin = async () => {
  if (!validateForm()) return
  setLoadingLogin(true)

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)

    if (!userCredential.user.emailVerified) {
      await sendEmailVerification(userCredential.user)
      toast.error("Verifica tu correo antes de iniciar sesión. Se ha reenviado el email.")
      return
    }

    await createOrUpdateUserInFirestore(userCredential.user)
    await checkAndEnrollMfaIfMissing(userCredential.user)
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as MultiFactorError).code === "auth/multi-factor-auth-required"
    ) {
      try {
        const resolver = getMultiFactorResolver(auth, error as MultiFactorError)
        setMfaResolver(resolver)

        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session,
        }

        const phoneAuthProvider = new PhoneAuthProvider(auth)
        const recaptchaVerifier = window.recaptchaVerifier!
        setRecaptchaVisible(true)
        const verificationId = await phoneAuthProvider.verifyPhoneNumber(
          phoneInfoOptions,
          recaptchaVerifier
        )

        setVerificationId(verificationId)
        setShowMfaDialog(true)
      } catch (err: unknown) {
        console.error("Error iniciando MFA:", err)
        toast.error("Error iniciando verificación 2FA.")
        setRecaptchaVisible(false)
      }
    } else {
      console.error("Error auth:", error)
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error("Error desconocido. Intenta nuevamente.")
      }
    }
  } finally {
    setLoadingLogin(false)
  }
}


  // Login con Google + MFA
  const handleGoogleLogin = async () => {
    setLoading(true)
      try {
        const provider = new GoogleAuthProvider()
        const userCredential = await signInWithPopup(auth, provider)
        await createOrUpdateUserInFirestore(userCredential.user)
        await checkAndEnrollMfaIfMissing(userCredential.user)
      } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "auth/multi-factor-auth-required"
    ) {
      try {
        const resolver = getMultiFactorResolver(auth, error as MultiFactorError)
        setMfaResolver(resolver)

        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session,
        }
        const phoneAuthProvider = new PhoneAuthProvider(auth)
        const recaptchaVerifier = window.recaptchaVerifier!
        setRecaptchaVisible(true)
        const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier)
        setVerificationId(verificationId)
        setShowMfaDialog(true)
      } catch (err: unknown) {
        console.error("Error iniciando MFA Google:", err)
        toast.error("Error iniciando verificación 2FA.")
        setRecaptchaVisible(false)
      }
    } else {
      console.error("Error login Google:", error)
      if (error instanceof FirebaseError) {
        toast.error(getErrorMessage(error))
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error("Error desconocido. Intenta nuevamente.")
      }
    }
  } finally {
      setLoading(false)
    }
  }

  // Submit único para login/registro
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLogin) {
      await handleLogin()
    } else {
      await handleRegister()
    }
  }

  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputsRef.current[index] = el
  }

  return (
    <>
      <style>{`
        #recaptcha-container {
          position: fixed !important;
          top: 10px;
          right: 10px;
          width: 304px !important;
          height: 78px !important;
          z-index: 999999 !important;
          opacity: ${recaptchaVisible ? 1 : 0};
          pointer-events: ${recaptchaVisible ? "auto" : "none"};
          transition: opacity 0.3s ease;
          background: transparent !important;
        }
      `}</style>

      <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
        <div id="recaptcha-container" />
        <div className="relative z-10 px-6 text-center max-w-lg">
          <h1 className="text-5xl font-extrabold leading-tight mb-4">
            {isLogin ? "Bienvenido/a a KLIP" : "Empieza en KLIP"}
          </h1>
          <p className="text-lg mb-8">🤖 Automatizamos TODO tu contenido en redes.</p>

          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="py-8 px-6">
              {!showEnrollPhone ? (
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
                    className={`w-full`}
                    disabled={loading}
                  >
                    {loading ? "Procesando..." : isLogin ? "Entrar" : "Registrarse"}
                  </Button>
                </form>
              ) : null}

              {!showEnrollPhone && (
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
                      onClick={() => setIsLogin(!isLogin)}
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

      {/* Modal MFA código */}
      <Dialog
        open={showMfaDialog}
        onOpenChange={(open) => {
          if (!loading) setShowMfaDialog(open)
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby="mfa-desc">
          <DialogHeader>
            <DialogTitle>Verificación en dos pasos</DialogTitle>
          </DialogHeader>

          <p id="mfa-desc" className="mb-4">
            Ingresa el código de 6 dígitos enviado a tu teléfono.
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
                disabled={loadingMfa}  // ✅ Solo se desactivan si estás verificando el código, no cuando cargó el modal
              />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              type="submit"
              className={`flex-1 ${loading ? "animate-pulse" : ""}`}
              onClick={isEnrollingMfa ? completeEnrollMfa : verifyMfaCode}
              disabled={loadingMfa || verificationCode.some((d) => d === "")}
            >
              {loadingLogin ? "Verificando..." : isLogin ? "Entrar" : "Registrarse"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => !loading && (isEnrollingMfa ? setShowEnrollPhone(false) : setShowMfaDialog(false))}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal inscripción teléfono MFA */}
      <Dialog
        open={showEnrollPhone}
        onOpenChange={(open) => {
          if (!loading) setShowEnrollPhone(open)
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby="enroll-phone-desc">
          <DialogHeader>
            <DialogTitle>Registra tu teléfono para 2FA</DialogTitle>
          </DialogHeader>

          <p id="enroll-phone-desc" className="mb-4">
            Para mayor seguridad, ingresa tu número de teléfono para activar la autenticación en dos pasos.
          </p>

          <PhoneInput
            placeholder="Introduce tu número de teléfono"
            value={phoneNumber}
            onChange={setPhoneNumber}
            defaultCountry="ES"
            international
            countryCallingCodeEditable={false}
            disabled={loading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-black"
          />

          {phoneNumber && !isValidPhoneNumber(phoneNumber) && (
            <p className="mt-1 text-sm text-red-500">Número de teléfono inválido</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => {
                if (phoneNumber) {
                  enrollMfaForUser(auth.currentUser!, phoneNumber)
                } else {
                  toast.error("Ingresa un número de teléfono válido")
                }
              }}
              disabled={loading || !phoneNumber || !isValidPhoneNumber(phoneNumber)}
            >
              Enviar código
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => !loading && setShowEnrollPhone(false)}
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
