"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { getDocs, collection } from "firebase/firestore"
import TaskInbox from "@/components/shared/taskinbox"
import TaskModal from "@/components/shared/taskmodal"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function AdminTasksPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  // 🔄 Buscar UID en colección `admin` por email
  const getUidFromEmail = async (email: string): Promise<string | null> => {
    const snapshot = await getDocs(collection(db, "admin"))
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      if (data.email?.toLowerCase().trim() === email.toLowerCase().trim()) {
        return docSnap.id
      }
    }
    return null
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const realUid = await getUidFromEmail(user.email)
        if (realUid) {
          setUid(realUid)
        } else {
          toast.error("No se encontró tu usuario en Firestore (admin).")
        }
      } else {
        setUid(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!uid) {
    return (
      <div className="p-6 text-red-500">
        Debes iniciar sesión como admin para ver tus tareas.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">📋 Tus tareas</h1>
        <Button onClick={() => setModalOpen(true)}>+ Nueva tarea</Button>
      </div>

      <TaskInbox adminId={uid} />

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        adminId={uid}
        task={null} // Nueva tarea
      />
    </div>
  )
}
