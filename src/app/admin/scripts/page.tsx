"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { db } from "@/lib/firebase"
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { ScriptForm } from "../../../components/shared/form"

type Script = {
  titulo: string
  contenido: string
  estado: number
  createdAt: Timestamp
  userId: string
}

export default function ScriptAdminPage() {
  const [scriptsByEmail, setScriptsByEmail] = useState<Record<string, Script[]>>({})

  useEffect(() => {
    const fetchScripts = async () => {
      const q = query(collectionGroup(db, "guiones"))
      const snapshot = await getDocs(q)

      const tempGrouped: Record<string, Script[]> = {}

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Script
        const path = docSnap.ref.path // users/{uid}/guiones/{id}
        const uid = path.split("/")[1]

        const userRef = doc(db, "users", uid)
        const userSnap = await getDoc(userRef)
        const email = userSnap.exists() ? userSnap.data().email || uid : uid

        if (!tempGrouped[email]) tempGrouped[email] = []
        tempGrouped[email].push({ ...data, userId: uid })
      }

      setScriptsByEmail(tempGrouped)
    }

    fetchScripts()
  }, [])

  return (
    <div className="relative">
      <h1 className="text-2xl font-bold mb-6">Guiones por Usuario</h1>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="absolute top-0 right-0">+ Crear Guión</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Crear Guión</DialogTitle>
          <ScriptForm />
        </DialogContent>
      </Dialog>

      <Accordion type="multiple" className="mt-8 space-y-2">
        {Object.entries(scriptsByEmail).map(([email, scripts]) => (
          <AccordionItem key={email} value={email}>
            <AccordionTrigger>{email}</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {scripts.map((script, index) => (
                <Card key={index} className="p-4 space-y-1">
                  <p className="font-semibold">{script.titulo}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {script.contenido}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estado: {["🆕 Nuevo", "✏️ Necesita Cambios", "✅ Aprobado"][script.estado] || "Desconocido"}
                  </p>
                </Card>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
