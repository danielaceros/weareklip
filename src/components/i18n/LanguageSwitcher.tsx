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
      // 1) cookie (la leerá tu RootLayout)
      await fetch(`/api/i18n/set-locale?locale=${next}`, { method: "POST" });

      // 2) persistir preferencia en Firestore: users/{uid}.settings.lang
      const user = auth.currentUser;
      if (user) {
        await setDoc(
          doc(db, "users", user.uid),
          { settings: { lang: next } },
          { merge: true }
        );
      }

      // 3) refrescar UI (para que NextIntl recargue strings)
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
