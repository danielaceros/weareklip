"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

const links = [
  { href: "/admin", label: "Pedidos" },
  { href: "/admin/scripts", label: "Crear Guiones" },
  { href: "/admin/usuarios", label: "Usuarios" }, // si quieres más adelante
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r p-4 flex flex-col justify-between">
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
      <Button variant="outline" onClick={() => signOut(auth)}>
        Cerrar sesión
      </Button>
    </aside>
  )
}
