"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  type CollectionReference,
} from "firebase/firestore";
import ClientsTable from "@/components/shared/clientstable";
import { useT } from "@/lib/i18n";

/* ------------------------------- Tipos ------------------------------- */
type ClienteCompleto = {
  uid: string;
  email: string;
  name?: string;
  estado?: string;
  notas?: string;
  subStatus?: string;
  planName?: string;
  createdAt?: number;
  hasBeenScheduled?: boolean;
  // ➕ Fechas de suscripción (ms epoch)
  subStart?: number | null;
  subEnd?: number | null;
};

type StripeResponse = {
  data: ClienteCompleto[];
  hasMore: boolean;
  lastId: string | null;
};

/* -------------------------- Firestore helpers ------------------------ */
const fetchFirestoreUsers = async (): Promise<ClienteCompleto[]> => {
  const usersSnap = await getDocs(collection(db, "users"));
  return usersSnap.docs.map((d) => {
    const data = d.data() as Partial<ClienteCompleto>;
    return {
      uid: d.id,
      ...data,
      estado: data?.estado || "Nuevo Cliente",
      hasBeenScheduled: data?.hasBeenScheduled || false,
    };
  }) as ClienteCompleto[];
};

/* --------------------------- Stripe helpers -------------------------- */
const fetchStripeClientsPage = async (
  startingAfter?: string | null
): Promise<StripeResponse> => {
  const res = await fetch(
    `/api/stripe/clients${startingAfter ? `?starting_after=${startingAfter}` : ""}`
  );
  if (!res.ok) throw new Error("Error cargando clientes de Stripe");
  return await res.json();
};

/* --------- Asegurar que existe el user en Firestore + bienvenida ------ */
const ensureUserExists = async (client: ClienteCompleto): Promise<string> => {
  const usersSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", client.email))
  );

  if (!usersSnap.empty) {
    return usersSnap.docs[0].id;
  }

  const docRef = doc(collection(db, "users") as CollectionReference);
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

/* ---------------------- util para enviar correos ---------------------- */
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

/* ============================ Página Admin =========================== */
export default function AdminDashboardPage() {
  const t = useT();
  const router = useRouter();

  const [clients, setClients] = useState<ClienteCompleto[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // evita cargas simultáneas
  const inFlight = useRef(false);

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status);

  /* --------------------- Cargar clientes (paginado) -------------------- */
  const loadStripeClients = useCallback(
    async (startingAfter: string | null = null) => {
      if (inFlight.current) return;
      inFlight.current = true;

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
          const onlyNew = merged.filter(
            (c) => !prev.some((p) => p.uid === c.uid)
          );
          return [...prev, ...onlyNew];
        });

        setLastId(stripeRes.lastId);
        setHasMore(stripeRes.hasMore);
      } catch (err) {
        console.error(err);
        toast.error(t("admin.common.loadError") || "Error al cargar clientes");
      } finally {
        setLoadingMore(false);
        inFlight.current = false;
      }
    },
    [t]
  );

  /* --------------------- Guardar cambios por celda --------------------- */
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
      if (!res.ok) throw new Error("Error al actualizar cliente");

      if (field === "estado" && value === "Nuevo Cliente") {
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
        await fetch("/api/send-video-production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
          }),
        });
      }

      if (field === "estado" && value === "Revisar Vídeo") {
        await fetch("/api/send-review-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || "cliente",
          }),
        });
      }

      if (field === "estado" && value === "Programado") {
        try {
          await fetch("/api/send-scheduling-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: uid,
              clientName: client.name || "cliente",
            }),
          });
          toast.success(
            t("admin.clients.scheduledMailSent") ||
              "Correo de programación enviado"
          );
        } catch (err) {
          console.error("Error enviando correo de programación:", err);
          toast.error(
            t("admin.clients.scheduledMailError") ||
              "Error al enviar correo de programación"
          );
        }
      }

      if (field === "estado" && value === "Finalizado") {
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
      toast.error(t("admin.common.saveError") || "Error al guardar cambios");
    }
  };

  useEffect(() => {
    loadStripeClients();
  }, [loadStripeClients]);

  const rawTitle = t("admin.clients.title");
  const pageTitle =
    rawTitle === "admin.clients.title" ? "📋 Client Status" : rawTitle;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{pageTitle}</h1>

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
