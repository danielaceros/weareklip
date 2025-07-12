"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import ScriptCard from "@/components/shared/scriptscard";
import ScriptEditorModal from "@/components/shared/scriptsmodal";

export interface Guion {
  firebaseId: string;
  titulo: string;
  contenido: string;
  estado: number;
  notas?: string;
  createdAt?: string;
}

// 📧 Notificación
const sendNotificationEmail = async (
  subject: string,
  content: string
) => {
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "rubengomezklip@gmail.com",
        subject,
        content,
      }),
    });
  } catch (err) {
    console.error("Error enviando notificación:", err);
  }
};

export default function GuionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [guiones, setGuiones] = useState<Guion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuion, setSelectedGuion] = useState<Guion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
          notas: d.notas ?? "",
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

  const handleUpdateGuion = async (updatedGuion: Guion) => {
    if (!userId || !userEmail) return;
    try {
      const ref = doc(db, "users", userId, "guiones", updatedGuion.firebaseId);
      await updateDoc(ref, {
        titulo: updatedGuion.titulo,
        contenido: updatedGuion.contenido,
        estado: updatedGuion.estado,
        notas: updatedGuion.estado === 1 ? updatedGuion.notas ?? "" : "",
      });

      setGuiones((prev) =>
        prev.map((g) => (g.firebaseId === updatedGuion.firebaseId ? updatedGuion : g))
      );

      toast.success("Cambios guardados correctamente");

      const estadoTexto =
        updatedGuion.estado === 0
          ? "🆕 Nuevo"
          : updatedGuion.estado === 1
          ? "✏️ Cambios solicitados"
          : "✅ Aprobado";

      await sendNotificationEmail(
        `✍️ Guion actualizado por ${userEmail}`,
        `Se ha actualizado el guion "${updatedGuion.titulo}".\n\nEstado: ${estadoTexto}\nNotas: ${updatedGuion.notas || "Sin notas"}`
      );
    } catch (error) {
      console.error("Error al guardar guion:", error);
      toast.error("Error al guardar", {
        description: "Verifica tu conexión o vuelve a intentarlo.",
      });
    }
  };

  const handleDeleteGuion = async (guionId: string, titulo: string) => {
    if (!userId || !userEmail) return;
    try {
      await deleteDoc(doc(db, "users", userId, "guiones", guionId));
      setGuiones((prev) => prev.filter((g) => g.firebaseId !== guionId));
      toast.success("Guion eliminado");

      await sendNotificationEmail(
        `🗑️ Guion eliminado por ${userEmail}`,
        `El cliente ha eliminado el guion titulado: "${titulo}".`
      );
    } catch (error) {
      console.error("Error al eliminar guion:", error);
      toast.error("Error al eliminar guion.");
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
            <ScriptCard
              key={guion.firebaseId}
              titulo={guion.titulo}
              contenido={guion.contenido}
              estado={guion.estado}
              onClick={() => {
                setSelectedGuion(guion);
                setModalOpen(true);
              }}
              onDelete={() => handleDeleteGuion(guion.firebaseId, guion.titulo)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No hay guiones disponibles.</p>
      )}

      {selectedGuion && (
        <ScriptEditorModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          guion={selectedGuion}
          onSave={handleUpdateGuion}
        />
      )}
    </div>
  );
}
