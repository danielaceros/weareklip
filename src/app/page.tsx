// src/app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirige siempre al login como ruta raíz
  redirect("/login");
}
