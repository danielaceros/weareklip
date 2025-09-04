"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import type { Locale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const current = (locale === "en" || locale === "fr" ? locale : "es") as Locale;
  const [saving, setSaving] = useState(false);

  const changeLocale = async (next: Locale) => {
    if (saving || next === current) return;
    setSaving(true);
    try {
      // 1) Actualizar cookie (la usará tu RootLayout)
      await fetch(`/api/i18n/set-locale?locale=${next}`, { method: "POST" });

      // 2) Persistir preferencia en backend vía CRUD API
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        await fetch(`/api/firebase/users/${user.uid}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            settings: { lang: next },
          }),
        });
      }

      // 3) Refrescar UI (para que NextIntl recargue strings)
      router.refresh();
    } finally {
      setSaving(false);
    }
  };


  return (
    <Select value={current} onValueChange={(v) => changeLocale(v as Locale)} disabled={saving}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="🌐 Language" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">🇪🇸 Español</SelectItem>
        <SelectItem value="en">🇬🇧 English</SelectItem>
        <SelectItem value="fr">🇫🇷 Français</SelectItem>
      </SelectContent>
    </Select>
  );
}

