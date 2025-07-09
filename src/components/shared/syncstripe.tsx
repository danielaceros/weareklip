"use client"

import { useEffect } from "react"

export function SyncStripe() {
  useEffect(() => {
    fetch("/api/stripe/sync")
      .then((res) => {
        if (!res.ok) throw new Error("Falló la sincronización con Stripe")
        return res.json()
      })
      .then((data) => {
        console.log("✔️ Stripe sync OK", data)
      })
      .catch((err) => {
        console.error("❌ Error sync Stripe", err)
      })
  }, [])

  return null
}
