// src/components/shared/clientcard.tsx
"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useT, type Locale } from "@/lib/i18n"
import { useLocale } from "next-intl"

type Props = {
  uid: string
  email: string
  name?: string
  planName?: string
  createdAt?: number // admite epoch en ms o en s
  lang?: Locale      // opcional: 'es' | 'en' | 'fr'
}

function toDateFromEpoch(value?: number): Date | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null
  // si es epoch en segundos (p.ej. 1717355523) lo pasamos a ms
  const ms = value < 1_000_000_000_000 ? value * 1000 : value
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

const LANG_BADGE: Record<Locale, string> = { es: "ES", en: "EN", fr: "FR" }
const LANG_FLAG: Record<Locale, string> = { es: "🇪🇸", en: "🇬🇧", fr: "🇫🇷" }

export default function ClienteCard({
  uid,
  email,
  name,
  planName,
  createdAt,
  lang,
}: Props) {
  const router = useRouter()
  const t = useT()
  const locale = useLocale() // 'es' | 'en' | 'fr'
  const displayLocale = locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US"

  const date = toDateFromEpoch(createdAt)
  const dateLabel = date ? date.toLocaleDateString(displayLocale) : t("common.unknown")

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-lg transition-all border border-gray-200"
      onClick={() => router.push(`/admin/client/${uid}`)}
      role="button"
      aria-label={`${t("sidebar.clientTitle")}: ${email}`}
      title={email}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{email}</p>
          <p className="text-sm text-muted-foreground">
            {name && name.trim().length > 0 ? name : t("common.unknown")}
          </p>
        </div>

        {/* Badge de idioma si está disponible */}
        {lang && (
          <Badge variant="secondary" className="shrink-0">
            <span className="mr-1" aria-hidden>
              {LANG_FLAG[lang]}
            </span>
            {LANG_BADGE[lang]}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">{planName || t("sidebar.noPlan")}</Badge>
        <Badge variant="default">{dateLabel}</Badge>
      </div>
    </Card>
  )
}
