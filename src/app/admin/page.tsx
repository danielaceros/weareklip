"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import ClientsTable from "@/components/shared/clientstable";

type ClienteCompleto = {
  uid: string;
  email: string;
  name?: string;
  estado?: string;
  notas?: string;
  subStatus?: string;
  planName?: string;
  createdAt?: number;
  hasBeenScheduled?: boolean; // Nuevo campo para controlar el primer envío
};

type StripeResponse = {
  data: ClienteCompleto[];
  hasMore: boolean;
  lastId: string | null;
};

const fetchFirestoreUsers = async (): Promise<ClienteCompleto[]> => {
  const usersSnap = await getDocs(collection(db, "users"));
  return usersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      ...data,
      estado: data.estado || "Nuevo Cliente",
      hasBeenScheduled: data.hasBeenScheduled || false, // Inicializar si no existe
    };
  }) as ClienteCompleto[];
};

const fetchStripeClientsPage = async (
  startingAfter?: string | null
): Promise<StripeResponse> => {
  const res = await fetch(
    `/api/stripe/clients${
      startingAfter ? `?starting_after=${startingAfter}` : ""
    }`
  );
  if (!res.ok) throw new Error("Error cargando clientes de Stripe");
  return await res.json();
};

const ensureUserExists = async (client: ClienteCompleto): Promise<string> => {
  console.log("🧪 Comprobando si existe el cliente:", client.email);
  const usersSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", client.email))
  );

  if (!usersSnap.empty) {
    return usersSnap.docs[0].id;
  }

  const docRef = doc(collection(db, "users"));
  await setDoc(docRef, {
    email: client.email,
    name: client.name || "",
    phone: "",
    instagramUser: "",
    role: "client",
    estado: "Nuevo Cliente",
    notas: "",
    createdAt: Date.now(),
    hasBeenScheduled: false,
  });

  console.log(
    "📬 Nuevo cliente creado. Enviando correo de bienvenida a Rubén:",
    client.name,
    client.email
  );
  await fetch("/api/send-welcome-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientName: client.name || "cliente",
      email: client.email,
    }),
  });

  return docRef.id;
};

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

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<ClienteCompleto[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status);

  const loadStripeClients = useCallback(
    async (startingAfter: string | null = null) => {
      try {
        setLoadingMore(true);

        const stripeRes = await fetchStripeClientsPage(startingAfter);
        const firestoreUsers = await fetchFirestoreUsers();

        const merged: ClienteCompleto[] = [];

        for (const stripeClient of stripeRes.data) {
          const uid = await ensureUserExists(stripeClient);
          const match = firestoreUsers.find(
            (u) => u.email === stripeClient.email
          );
          merged.push({ ...stripeClient, ...match, uid });
        }

        setClients((prev) => {
          const newClients = merged.filter(
            (newClient) =>
              !prev.some((existing) => existing.uid === newClient.uid)
          );
          return [...prev, ...newClients];
        });

        setLastId(stripeRes.lastId);
        setHasMore(stripeRes.hasMore);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar clientes");
      } finally {
        setLoadingMore(false);
      }
    },
    []
  );

  const handleChange = async (
    uid: string,
    field: "estado" | "notas",
    value: string
  ) => {
    setClients((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, [field]: value } : c))
    );

    const client = clients.find((c) => c.uid === uid);
    if (!client) return;

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, field, value }),
      });

      if (!res.ok) {
        throw new Error("Error al actualizar cliente");
      }

      if (field === "estado" && value === "Nuevo Cliente") {
        console.log("📬 Enviando correo de bienvenida a:", client.email);
        await fetch("/api/send-welcome-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
            email: client.email,
          }),
        });
      }

      if (field === "estado" && value === "Generar Guión") {
        console.log("📬 Enviando correo 'generar guion' a Ruben");
        await fetch("/api/send-script-request-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
            uploadLink:
              "https://drive.google.com/file/d/1b3Hti2IW4aw_6_0ppNqVttW2CS7j3p7N/view?usp=drive_link",
            phoneNumber: "+34 622 26 94 71",
          }),
        });
      }

      if (field === "estado" && value === "Esperando Confirmación Guión") {
        console.log("📬 Enviando correo 'script confirmation' a Rubén");
        await fetch("/api/send-script-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
            scriptsLink: "https://portal.weareklip.com/guiones",
          }),
        });
      }

      if (field === "estado" && value === "Generar Vídeo") {
        console.log("📬 Enviando correo 'video production started' a Rubén");
        await fetch("/api/send-video-production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
          }),
        });
      }

      if (field === "estado" && value === "Revisar Vídeo") {
        console.log("📬 Enviando correo 'review videos' a Rubén");
        await fetch("/api/send-review-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
          }),
        });
      }

      if (field === "estado" && value === "Programado") {
        console.log("📬 Enviando correo de programación");

        try {
          console.log("🧪 field:", field, "value:", value);
          await fetch("/api/send-scheduling-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: uid,
              clientName: client.name || "cliente",
            }),
          });

          toast.success("Correo de programación enviado");
        } catch (err) {
          console.error("Error enviando correo de programación:", err);
          toast.error("Error al enviar correo de programación");
        }
      }

      if (field === "estado" && value === "Finalizado") {
        console.log("📬 Enviando correo de finalización");
        await fetch("/api/send-finished-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
            archiveLink: "https://portal.weareklip.com/archivo",
          }),
        });
      }

      if (field === "estado") {
        const htmlContent = `
          Hola ${client.name || "cliente"},<br/><br/>
          Tu estado ahora es: <strong>${value || "Sin estado"}</strong>.
        `;
        await sendNotificationEmail(
          "rubengomezklip@gmail.com",
          "Tu estado ha sido actualizado",
          htmlContent
        );
      }
    } catch (err) {
      console.error("Error al guardar cambios:", err);
      toast.error("Error al guardar cambios");
    }
  };

  useEffect(() => {
    loadStripeClients();
  }, [loadStripeClients]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">📋 Estados de Clientes</h1>
      <ClientsTable
        clients={clients}
        isActive={isActive}
        onChange={handleChange}
        onRowClick={(uid) => router.push(`/admin/client/${uid}`)}
        onLoadMore={() => loadStripeClients(lastId)}
        hasMore={hasMore}
        loadingMore={loadingMore}
      />
    </div>
  );
}
