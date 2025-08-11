// src/app/login/page.tsx
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
  sendEmailVerification,
  MultiFactorResolver,
  MultiFactorError,
} from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import AuthForm from "@/components/shared/auth/authform"
import GoogleLoginButton from "@/components/shared/auth/googleloginbutton"
import MfaDialog from "@/components/shared/auth/mfa"
import PhoneEnrollDialog from "@/components/shared/auth/phonenroll"
import { isValidPhoneNumber } from "react-phone-number-input"
import { useT } from "@/lib/i18n"

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier
  }
}

export default function AuthPage() {
  const t = useT()
  const router = useRouter()

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>()
  const [verificationCode, setVerificationCode] = useState<string[]>(["", "", "", "", "", ""])
  const [showMfaDialog, setShowMfaDialog] = useState(false)
  const [showEnrollPhone, setShowEnrollPhone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loadingMfa, setLoadingMfa] = useState(false)
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)

  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Mapea códigos de Firebase a claves de traducción
  const ERROR_KEY: Record<string, string> = {
    "auth/invalid-email": "login.firebase.invalidEmail",
    "auth/user-not-found": "login.firebase.userNotFound",
    "auth/wrong-password": "login.firebase.wrongPassword",
    "auth/email-already-in-use": "login.firebase.emailInUse",
    "auth/weak-password": "login.firebase.weakPassword",
    "auth/too-many-requests": "login.firebase.tooMany",
    "auth/multi-factor-auth-required": "login.firebase.mfaRequired",
  }

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof FirebaseError) {
      const key = ERROR_KEY[error.code]
      if (key) return t(key)
      return error.message || t("common.unknown")
    }
    return t("common.unknown")
  }

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
      })
      verifier.render().then(() => {
        window.recaptchaVerifier = verifier
      })
    }

    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        delete window.recaptchaVerifier
      }
    }
  }, [])

  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputsRef.current[index] = el
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

  const validateForm = (): boolean => {
    if (!email || !password) {
      toast.warning(t("login.form.completeAll"))
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.warning(t("login.form.invalidEmail"))
      return false
    }
    if (password.length < 6) {
      toast.warning(t("login.form.weakPassword"))
      return false
    }
    return true
  }

  const createOrUpdateUserInFirestore = async (user: User) => {
    const ref = doc(db, "users", user.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: (user.email || "").toLowerCase().trim(),
        name: "",
        role: "client",
        createdAt: serverTimestamp(),
      })
    } else {
      await setDoc(
        ref,
        { email: (user.email || "").toLowerCase().trim() },
        { merge: true }
      )
    }
  }

  const checkAndEnrollMfaIfMissing = async (user: User) => {
    const mfaUser = multiFactor(user)
    if (mfaUser.enrolledFactors.length === 0) {
      setShowEnrollPhone(true)
    } else {
      router.push("/dashboard")
    }
  }

  const handleLogin = async () => {
    if (!validateForm()) return
    setLoadingLogin(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)

      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user)
        toast.error(t("login.toasts.verifyEmail"))
        return
      }

      await createOrUpdateUserInFirestore(userCredential.user)
      await checkAndEnrollMfaIfMissing(userCredential.user)
    } catch (error: unknown) {
      if (error instanceof FirebaseError && error.code === "auth/multi-factor-auth-required") {
        const resolver = getMultiFactorResolver(auth, error as MultiFactorError)
        setMfaResolver(resolver)
        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session,
        }
        const phoneAuthProvider = new PhoneAuthProvider(auth)
        const verificationId = await phoneAuthProvider.verifyPhoneNumber(
          phoneInfoOptions,
          window.recaptchaVerifier!
        )
        setVerificationId(verificationId)
        setShowMfaDialog(true)
      } else {
        toast.error(getErrorMessage(error))
      }
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleRegister = async () => {
    if (!validateForm()) return
    setLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await createOrUpdateUserInFirestore(userCredential.user)
      await checkAndEnrollMfaIfMissing(userCredential.user)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      await createOrUpdateUserInFirestore(userCredential.user)
      await checkAndEnrollMfaIfMissing(userCredential.user)
    } catch (error: unknown) {
      if (error instanceof FirebaseError && error.code === "auth/multi-factor-auth-required") {
        const resolver = getMultiFactorResolver(auth, error as MultiFactorError)
        setMfaResolver(resolver)
        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session,
        }
        const phoneAuthProvider = new PhoneAuthProvider(auth)
        const verificationId = await phoneAuthProvider.verifyPhoneNumber(
          phoneInfoOptions,
          window.recaptchaVerifier!
        )
        setVerificationId(verificationId)
        setShowMfaDialog(true)
      } else {
        toast.error(getErrorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }

  const verifyMfaCode = async () => {
    if (verificationCode.some((d) => d === "")) return toast.warning(t("login.mfa.completeCode"))
    if (!mfaResolver || !verificationId) return toast.error(t("login.mfa.incompleteProcess"))

    setLoadingMfa(true)
    try {
      const code = verificationCode.join("")
      const cred = PhoneAuthProvider.credential(verificationId, code)
      const assertion = PhoneMultiFactorGenerator.assertion(cred)
      const userCredential = await mfaResolver.resolveSignIn(assertion)
      await createOrUpdateUserInFirestore(userCredential.user)
      toast.success(t("login.mfa.verified"))
      setShowMfaDialog(false)
      router.push("/dashboard")
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoadingMfa(false)
    }
  }

  const completeEnrollMfa = async () => {
    if (!verificationId || verificationCode.some((d) => d === "")) {
      toast.warning(t("login.mfa.completeCode"))
      return
    }

    setLoading(true)
    try {
      const code = verificationCode.join("")
      const cred = PhoneAuthProvider.credential(verificationId, code)
      const assertion = PhoneMultiFactorGenerator.assertion(cred)
      const user = auth.currentUser
      if (!user) throw new Error("Usuario no autenticado")

      await multiFactor(user).enroll(assertion, t("login.mfa.deviceLabel"))
      toast.success(t("login.mfa.enrolled"))
      router.push("/dashboard")
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const enrollMfaForUser = async (user: User, phone: string) => {
    if (!isValidPhoneNumber(phone)) {
      toast.error(t("login.mfa.invalidPhone"))
      return
    }
    setLoading(true)
    try {
      const session = await multiFactor(user).getSession()
      const phoneAuthProvider = new PhoneAuthProvider(auth)
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        { phoneNumber: phone, session },
        window.recaptchaVerifier!
      )
      setVerificationId(verificationId)
      setShowMfaDialog(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLogin) {
      handleLogin()
    } else {
      handleRegister()
    }
  }

  return (
    <>
      <main className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 min-h-screen flex items-center justify-center text-white">
        <div className="relative z-10 px-6 text-center max-w-lg">
          <h1 className="text-5xl font-extrabold leading-tight mb-4">
            {isLogin ? t("login.titleLogin") : t("login.titleRegister")}
          </h1>
          <p className="text-lg mb-8">{t("login.subtitle")}</p>

          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="py-8 px-6">
              {!showEnrollPhone && (
                <>
                  <AuthForm
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                    handleSubmit={handleSubmit}
                    isLogin={isLogin}
                    loading={loading || loadingLogin}
                    toggleMode={() => setIsLogin(!isLogin)}
                  />
                  <GoogleLoginButton
                    handleGoogleLogin={handleGoogleLogin}
                    loading={loading}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <MfaDialog
        showMfaDialog={showMfaDialog}
        setShowMfaDialog={setShowMfaDialog}
        verificationCode={verificationCode}
        onOtpChange={onOtpChange}
        onOtpKeyDown={onOtpKeyDown}
        setInputRef={setInputRef}
        verifyMfaCode={verifyMfaCode}
        completeEnrollMfa={completeEnrollMfa}
        loadingMfa={loadingMfa}
        loadingLogin={loadingLogin}
        isLogin={isLogin}
        isEnrollingMfa={false}
        loading={loading}
      />

      <PhoneEnrollDialog
        showEnrollPhone={showEnrollPhone}
        setShowEnrollPhone={setShowEnrollPhone}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        enrollMfaForUser={enrollMfaForUser}
        loading={loading}
      />
    </>
  )
}
