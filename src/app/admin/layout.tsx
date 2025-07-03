"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ReactNode } from "react"
import { AdminSidebar } from "@/components/shared/adminsidebar"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/")
        return
      }

      const ref = doc(db, "users", user.uid)
      const snap = await getDoc(ref)

      if (!snap.exists() || snap.data().role !== "admin") {
        router.push("/")
        return
      }

      setAllowed(true)
      setChecking(false)
    })

    return () => unsubscribe()
  }, [router])

  if (checking || !allowed) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-muted p-6">{children}</main>
    </div>
  )
}
