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
import ScriptCard from "@/components/shared/scriptscard";
import ScriptEditorModal from "@/components/shared/scriptsmodal";
import { Button } from "@/components/ui/button";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import toast from "react-hot-toast";

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
  const [guionToDelete, setGuionToDelete] = useState<Guion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGuiones = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const ref = collection(db, "users", uid, "guiones");
      const snapshot = await getDocs(ref);

      if (snapshot.empty) {
        toast("Aún no tienes guiones. Cuando se generen, aparecerán aquí.");
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
      handleError(error, "Error al cargar guiones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        handleError(null, "Debes iniciar sesión para ver tus guiones.");
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
    
    const loadingToast = showLoading("Actualizando guión...");
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

      showSuccess("Cambios guardados correctamente");

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
      handleError(error, "Error al guardar guion");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleDeleteConfirmado = async () => {
    if (!userId || !userEmail || !guionToDelete) return;

    setIsDeleting(true);
    const loadingToast = showLoading("Eliminando guión...");

    try {
      await deleteDoc(doc(db, "users", userId, "guiones", guionToDelete.firebaseId));
      setGuiones((prev) => prev.filter((g) => g.firebaseId !== guionToDelete.firebaseId));
      
      // Cerrar modal de edición si está abierto
      setModalOpen(false);
      setSelectedGuion(null);
      
      showSuccess(" Guion eliminado permanentemente");
      
      await sendNotificationEmail(
        `🗑️ Guion eliminado por ${userEmail}`,
        `El cliente ha eliminado el guion titulado: "${guionToDelete.titulo}".`
      );
    } catch (error) {
      console.error("Error al eliminar guion:", error);
      handleError(error, "❌ Error al eliminar el guion");
    } finally {
      setIsDeleting(false);
      toast.dismiss(loadingToast);
      setGuionToDelete(null);
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
              onDelete={() => setGuionToDelete(guion)}
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

      {/* Diálogo de confirmación para eliminar */}
      {guionToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">¿Eliminar guion?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              ¿Estás seguro de que deseas eliminar el guion <strong>{guionToDelete.titulo}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setGuionToDelete(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteConfirmado}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Eliminando...
                  </span>
                ) : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}