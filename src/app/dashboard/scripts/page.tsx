"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Guion {
  firebaseId: string;
  titulo: string;
  contenido: string;
  estado: number;
  createdAt?: string;
}

export default function GuionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [guiones, setGuiones] = useState<Guion[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGuion, setSelectedGuion] = useState<Guion | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [contenidoEditado, setContenidoEditado] = useState("");
  const [estadoEditado, setEstadoEditado] = useState("0");
  const [open, setOpen] = useState(false);

  // Función para enviar mail de notificación
  const sendNotificationEmail = async (
    to: string,
    subject: string,
    content: string
  ) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, content }),
      });
    } catch (err) {
      console.error("Error enviando correo:", err);
    }
  };

  const fetchGuiones = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const ref = collection(db, "users", uid, "guiones");
      const snapshot = await getDocs(ref);

      if (snapshot.empty) {
        toast("Aún no tienes guiones", {
          description: "Cuando se generen, aparecerán aquí.",
        });
      }

      const data: Guion[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          firebaseId: doc.id,
          titulo: d.titulo ?? "Sin título",
          contenido: d.contenido ?? "",
          estado: d.estado ?? 0,
          createdAt: d.createdAt ?? null,
        };
      });

      setGuiones(data);
    } catch (error) {
      console.error("Error al obtener guiones:", error);
      toast.error("Error al cargar guiones", {
        description: "Intenta recargar la página o contacta soporte.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast.error("No autenticado", {
          description: "Debes iniciar sesión para ver tus guiones.",
        });
        setUserId(null);
        setUserEmail(null);
        setGuiones([]);
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email ?? null);
      await fetchGuiones(user.uid);
    });

    return () => unsubscribe();
  }, [fetchGuiones]);

  const openEditor = (guion: Guion) => {
    setSelectedGuion(guion);
    setTituloEditado(guion.titulo);
    setContenidoEditado(guion.contenido);
    setEstadoEditado(String(guion.estado ?? 0));
    setOpen(true);
  };

  const guardarCambios = async () => {
    if (!userId || !selectedGuion || !userEmail) {
      toast.error("No se pudo guardar", {
        description: "Falta información del usuario o guion.",
      });
      return;
    }

    try {
      const ref = doc(db, "users", userId, "guiones", selectedGuion.firebaseId);
      const nuevoEstado = parseInt(estadoEditado);

      await updateDoc(ref, {
        titulo: tituloEditado,
        contenido: contenidoEditado,
        estado: nuevoEstado,
      });

      setGuiones((prev) =>
        prev.map((g) =>
          g.firebaseId === selectedGuion.firebaseId
            ? {
                ...g,
                titulo: tituloEditado,
                contenido: contenidoEditado,
                estado: nuevoEstado,
              }
            : g
        )
      );

      // Enviar correo notificando el cambio
      const subject = `Guion modificado por ${userEmail}`;
      const content = `
        El usuario con email <strong>${userEmail}</strong> ha modificado el guion:
        <ul>
          <li><strong>ID:</strong> ${selectedGuion.firebaseId}</li>
          <li><strong>Título nuevo:</strong> ${tituloEditado}</li>
          <li><strong>Estado nuevo:</strong> ${nuevoEstado}</li>
          <li><strong>Contenido nuevo:</strong><br/>${contenidoEditado
            .replace(/\n/g, "<br/>")
            .substring(0, 500)}${contenidoEditado.length > 500 ? "..." : ""}</li>
        </ul>
      `;

      await sendNotificationEmail("klipprueba@gmail.com", subject, content);

      toast.success("Cambios guardados correctamente");
      setOpen(false);
    } catch (error) {
      console.error("Error al guardar guion:", error);
      toast.error("Error al guardar", {
        description: "Verifica tu conexión o vuelve a intentarlo.",
      });
    }
  };

  const renderEstado = (estado: number) => {
    switch (estado) {
      case 0:
        return <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>;
      case 1:
        return <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>;
      case 2:
        return <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Mis Guiones</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando guiones...</p>
      ) : guiones.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {guiones.map((guion) => (
            <Card
              key={guion.firebaseId}
              className="cursor-pointer hover:shadow-lg transition"
              onClick={() => openEditor(guion)}
              tabIndex={0}
              role="button"
              aria-label={`Editar guion ${guion.titulo}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openEditor(guion);
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-lg truncate">{guion.titulo}</h2>
                  {renderEstado(guion.estado)}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
                  {guion.contenido}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No hay guiones disponibles.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Guion</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={tituloEditado}
              onChange={(e) => setTituloEditado(e.target.value)}
              placeholder="Título"
              aria-label="Editar título del guion"
            />
            <Textarea
              value={contenidoEditado}
              onChange={(e) => setContenidoEditado(e.target.value)}
              rows={6}
              placeholder="Contenido del guion"
              aria-label="Editar contenido del guion"
            />
            <Select value={estadoEditado} onValueChange={setEstadoEditado}>
              <SelectTrigger aria-label="Selecciona estado">
                <SelectValue placeholder="Selecciona estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">🆕 Nuevo</SelectItem>
                <SelectItem value="1">✏️ Cambios</SelectItem>
                <SelectItem value="2">✅ Aprobado</SelectItem>
              </SelectContent>
            </Select>

            <Button className="mt-2" onClick={guardarCambios}>
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
