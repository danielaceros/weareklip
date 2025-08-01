"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useEffect, useState, useRef } from "react"
import { ChevronDown, LogOut } from "lucide-react"

interface UserInfo {
  email: string
  photoURL?: string
  plan?: string
  uid?: string
}

const links = [
  { href: "/admin", label: "Home" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/tasks", label: "Tareas" },
  { href: "/admin/notifications", label: "Notificaciones" },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return setUserInfo(null)

      try {
        const token = await user.getIdToken()
        const res = await fetch("/api/stripe/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        setUserInfo({
          email: user.email ?? "Sin email",
          photoURL: user.photoURL ?? "",
          plan: data?.plan || "Sin plan",
          uid: user.uid,
        })
      } catch {
        setUserInfo({
          email: user.email ?? "Sin email",
          photoURL: user.photoURL ?? "",
          plan: "Sin plan",
          uid: user.uid,
        })
      }
    })

    return () => unsubscribe()
  }, [])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownOpen])

  return (
    <aside className="w-64 bg-white border-r p-4 flex flex-col justify-between">
      {/* Menú principal */}
      <div>
        <h2 className="text-lg font-bold mb-6">Panel Admin</h2>
        <nav className="flex flex-col gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-md hover:bg-muted transition ${
                pathname === link.href ? "bg-muted font-semibold" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Perfil */}
      {userInfo ? (
        <div
          ref={dropdownRef}
          className="relative cursor-pointer select-none"
          tabIndex={0}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setDropdownOpen(!dropdownOpen)
            }
          }}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-100">
            {userInfo.photoURL ? (
              <Image
                src={userInfo.photoURL}
                alt="Foto de perfil"
                width={40}
                height={40}
                className="rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
                {userInfo.email[0].toUpperCase()}
              </div>
            )}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate font-semibold">{userInfo.email}</span>
              <small className="text-gray-500 truncate">Plan: {userInfo.plan}</small>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 bottom-full mb-2 w-full bg-white border rounded shadow-md z-10">
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-600">No autenticado</p>
      )}
    </aside>
  )
}
