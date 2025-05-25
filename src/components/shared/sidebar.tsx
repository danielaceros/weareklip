"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const links = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/new", label: "Nuevo pedido" },
  { href: "/dashboard/orders", label: "Mis pedidos" },
  { href: "/dashboard/billing", label: "Suscripción / Pagos" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-bold mb-6">Panel Cliente</h2>
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
  );
}
