import { useEffect, useState, useRef, useCallback } from "react"
import { db, auth } from "@/lib/firebase"
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Inbox } from "lucide-react"
import Link from "next/link"

type Task = {
  id: string
  descripcion: string
  estado: "Nuevo" | "Hecho"
  creadoEn: number
}

export function TaskInboxPreview() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchUidByEmail = async (email: string): Promise<string | null> => {
    const adminRef = collection(db, "admin")
    const q = query(adminRef, where("email", "==", email.toLowerCase().trim()))
    const snapshot = await getDocs(q)
    return snapshot.empty ? null : snapshot.docs[0].id
  }

  const fetchTasks = useCallback(async () => {
    const user = auth.currentUser
    if (!user?.email) return
    const adminUid = await fetchUidByEmail(user.email)
    if (!adminUid) return

    const snap = await getDocs(collection(db, "admin", adminUid, "tasks"))
    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Task[]
    setTasks(data.filter((t) => t.estado === "Nuevo"))
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email) fetchTasks()
    })
    return () => unsub()
  }, [fetchTasks])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50" ref={ref}>
      <button
        className="relative p-3 bg-white border rounded-full shadow-md hover:bg-gray-100 transition"
        onClick={() => setOpen(!open)}
        aria-label="Abrir bandeja de tareas"
      >
        <Inbox className="w-5 h-5 text-gray-700" />
        {tasks.length > 0 && (
          <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full px-1.5">
            {tasks.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-14 w-80 bg-white border rounded-lg shadow-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">📥 Tareas recientes</h3>
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-500">No tienes tareas nuevas.</p>
          ) : (
            <ul className="text-sm list-disc ml-4 space-y-1">
              {tasks.slice(0, 3).map((task) => (
                <li key={task.id} className="text-gray-800">{task.descripcion}</li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/tasks"
            className="block text-sm text-blue-600 hover:underline text-right"
          >
            Ver todas las tareas →
          </Link>
        </div>
      )}
    </div>
  )
}
