// src/app/admin/client/[uid]/page.tsx
"use client";

import type { Video, ReelEstado } from "@/types/video";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import type { DocumentReference } from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import ClienteDatosForm from "@/components/shared/clientdatosform";
import GuionesSection from "@/components/shared/guionesection";
import VideosSection from "@/components/shared/videosection";
import EditarGuionModal from "@/components/shared/editarguion";
import EditarVideoModal from "@/components/shared/editarvideo";
import ClonacionVideosSection from "@/components/shared/dropzonecl";
import CalendarioMensual from "@/components/shared/CalendarioMensual";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import toast from "react-hot-toast";
import { logAction } from "@/lib/logs";
import { useTranslations } from "next-intl";

/* 📧 Notificaciones (recibe el contexto de error traducido) */
const sendNotificationEmail = async (
  subject: string,
  content: string,
  errorCtx: string
) => {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "rubengomezklip@gmail.com",
        subject,
        content,
      }),
    });

    if (!res.ok) {
      throw new Error("Server error");
    }
  } catch (err) {
    handleError(err, errorCtx);
  }
};

type Cliente = {
  email: string;
  name?: string;
  stripeId?: string;
  stripeLink?: string;
  createdAt?: number;
  estado?: string;
  instagramUser?: string;
  notas?: string;
  phone?: string;
  role?: string;
};

type Guion = {
  firebaseId: string;
  titulo: string;
  contenido: string;
  estado: number;
};

/** Normaliza reelEstado almacenado como string libre a un ReelEstado válido */
function normalizeReelEstado(input: unknown): ReelEstado | undefined {
  if (typeof input !== "string") return undefined;
  const s = input.toLowerCase();
  if (s.includes("recib")) return "Recibido";
  if (s.includes("aprob")) return "Guión aprobado";
  if (s.includes("voz")) return "Voz generada";
  if (s.includes("vídeo") || s.includes("video")) return "Vídeo creado";
  if (s.includes("entreg")) return "Entregado";
  return undefined;
}

export default function ClientProfilePage() {
  const t = useTranslations("clientPage");

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [guiones, setGuiones] = useState<Guion[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [modalGuionOpen, setModalGuionOpen] = useState(false);
  const [modalVideoOpen, setModalVideoOpen] = useState(false);
  const [nuevoVideoTitulo, setNuevoVideoTitulo] = useState("");
  const [archivoVideo, setArchivoVideo] = useState<File | null>(null);
  const [guionSeleccionado, setGuionSeleccionado] = useState<Guion | null>(null);
  const [videoSeleccionado, setVideoSeleccionado] = useState<Video | null>(null);

  const rawParams = useParams();
  const uid = Array.isArray(rawParams.uid) ? rawParams.uid[0] : rawParams.uid;

  const fetchSubscription = useCallback(
    async (email: string) => {
      try {
        const res = await fetch(
          `/api/stripe/email?email=${encodeURIComponent(email)}`
        );
        if (!res.ok) throw new Error("fetch-subscription");

        const json = await res.json();
        setSubscriptionPlan(json?.plan || t("subscription.none"));
      } catch (error) {
        handleError(error, t("errors.subscriptionLoad"));
        setSubscriptionPlan(t("subscription.error"));
      }
    },
    [t]
  );

  const fetchData = useCallback(async () => {
    if (!uid) {
      handleError(null, t("errors.invalidUid"));
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        setCliente(null);
        return;
      }

      const userData = userSnap.data() as Cliente;
      setCliente(userData);

      if (userData.email) fetchSubscription(userData.email);

      // Guiones
      const guionesSnap = await getDocs(collection(userDocRef, "guiones"));
      setGuiones(
        guionesSnap.docs.map((doc) => ({
          firebaseId: doc.id,
          ...doc.data(),
        })) as Guion[]
      );

      // Vídeos
      const videosSnap = await getDocs(collection(userDocRef, "videos"));
      const vids: Video[] = videosSnap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const estadoValue =
          typeof data.estado === "number"
            ? data.estado
            : parseInt(String(data.estado ?? "0"), 10);

        return {
          firebaseId: docSnap.id,
          titulo: typeof data.titulo === "string" ? data.titulo : "",
          url: typeof data.url === "string" ? data.url : "",
          estado: Number.isFinite(estadoValue) ? (estadoValue as number) : 0,
          notas: typeof data.notas === "string" ? data.notas : "",
          reelEstado: normalizeReelEstado(data.reelEstado),
          // comments: si lo necesitas, puedes mapearlos aquí (array de objetos)
        };
      });

      setVideos(vids);
    } catch (error) {
      handleError(error, t("errors.loadClient"));
    } finally {
      setLoading(false);
    }
  }, [uid, fetchSubscription, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveCliente = async () => {
    if (!uid || !cliente) {
      handleError(null, t("errors.missingClientData"));
      return;
    }

    const loadingToast = showLoading(t("loading.savingClient"));
    try {
      // ✅ Tipado fuerte: referencia y payload
      const userRef = doc(db, "users", uid) as DocumentReference<Cliente>;
      const payload: Partial<Cliente> = { ...cliente };

      await updateDoc(userRef, payload);
      toast.dismiss(loadingToast);
      showSuccess(t("success.clientSaved"));
      fetchData();
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("errors.saveClient"));
    }
  };

  const handleCreateGuion = async (titulo: string, contenido: string) => {
    if (!uid || !titulo || !contenido) {
      handleError(null, t("errors.missingScriptFields"));
      return;
    }

    const loadingToast = showLoading(t("loading.creatingScript"));
    try {
      const docRef = await addDoc(collection(db, "users", uid, "guiones"), {
        titulo,
        contenido,
        estado: 0,
        creadoEn: new Date(),
      });

      await logAction({
        type: "guion",
        action: "creado",
        uid,
        admin: "rubengomezklip@gmail.com",
        message: `📜 New script for ${cliente?.email || uid}`,
        targetId: docRef.id,
      });

      toast.dismiss(loadingToast);
      showSuccess(t("success.scriptCreated"));

      await sendNotificationEmail(
        `📜 Nuevo guion creado para ${cliente?.email || uid}`,
        `Se ha creado un nuevo guion titulado: "${titulo}".`,
        t("errors.emailSend")
      );

      setModalGuionOpen(false);
      fetchData();
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("errors.saveScript"));
    }
  };

  const handleUpdateGuion = async () => {
    if (!uid || !guionSeleccionado) {
      handleError(null, t("errors.missingScriptToUpdate"));
      return;
    }

    const loadingToast = showLoading(t("loading.updatingScript"));
    try {
      const refDoc = doc(db, "users", uid, "guiones", guionSeleccionado.firebaseId);
      await updateDoc(refDoc, {
        titulo: guionSeleccionado.titulo,
        contenido: guionSeleccionado.contenido,
        estado: guionSeleccionado.estado,
      });

      await logAction({
        type: "guion",
        action: "editado",
        uid,
        admin: "rubengomezklip@gmail.com",
        targetId: guionSeleccionado.firebaseId,
        message: `📜 Script edited for ${cliente?.email || uid}`,
      });

      toast.dismiss(loadingToast);
      showSuccess(t("success.scriptUpdated"));
      setGuionSeleccionado(null);
      fetchData();
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("errors.updateScript"));
    }
  };

  const handleUploadVideo = async () => {
    if (!uid || !archivoVideo || !nuevoVideoTitulo.trim()) {
      handleError(null, t("errors.missingVideoFields"));
      return;
    }

    if (archivoVideo.size > 100 * 1024 * 1024) {
      handleError(null, t("errors.maxFile"));
      return;
    }

    const loadingToast = showLoading(t("loading.uploadingVideo"));
    try {
      const storageRef = ref(storage, `users/${uid}/videos/${archivoVideo.name}`);
      const uploadTask = uploadBytesResumable(storageRef, archivoVideo);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          toast.dismiss(loadingToast);
          handleError(error, t("errors.uploadVideo"));
          setUploadProgress(null);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            const docRef = await addDoc(collection(db, "users", uid, "videos"), {
              titulo: nuevoVideoTitulo,
              url,
              estado: 0, // number
              reelEstado: "Recibido" as ReelEstado, // estado inicial del progreso
              creadoEn: new Date(),
            });

            await logAction({
              type: "video",
              action: "creado",
              uid,
              admin: "rubengomezklip@gmail.com",
              targetId: docRef.id,
              message: `🎥 Video uploaded for ${cliente?.email || uid}`,
            });

            toast.dismiss(loadingToast);
            showSuccess(t("success.videoUploaded"));

            await sendNotificationEmail(
              `🎬 Nuevo video subido por ${cliente?.email || uid}`,
              `Se ha subido un nuevo video titulado: "${nuevoVideoTitulo}".`,
              t("errors.emailSend")
            );

            setUploadProgress(null);
            setModalVideoOpen(false);
            setArchivoVideo(null);
            setNuevoVideoTitulo("");
            fetchData();
          } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, t("errors.saveVideo"));
            setUploadProgress(null);
          }
        }
      );
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("errors.uploadVideo"));
      setUploadProgress(null);
    }
  };

  const handleUpdateVideo = async (
    updatedVideo: Video & { nuevoArchivo?: File }
  ) => {
    if (!uid || !updatedVideo) {
      handleError(null, t("errors.missingVideoToUpdate"));
      return;
    }

    const loadingToast = showLoading(t("loading.updatingVideo"));
    try {
      let url = updatedVideo.url;

      if (updatedVideo.nuevoArchivo) {
        if (updatedVideo.nuevoArchivo.size > 100 * 1024 * 1024) {
          toast.dismiss(loadingToast);
          handleError(null, t("errors.maxFile"));
          return;
        }

        // Subida simple y tipado correcto
        const storageRef = ref(
          storage,
          `users/${uid}/videos/${updatedVideo.nuevoArchivo.name}`
        );
        const snapshot = await uploadBytes(storageRef, updatedVideo.nuevoArchivo);
        url = await getDownloadURL(snapshot.ref);
      }

      await updateDoc(doc(db, "users", uid, "videos", updatedVideo.firebaseId), {
        titulo: updatedVideo.titulo,
        estado: updatedVideo.estado, // number
        notas: updatedVideo.notas || "",
        url,
        ...(updatedVideo.reelEstado
          ? ({ reelEstado: updatedVideo.reelEstado } as { reelEstado: ReelEstado })
          : {}),
      });

      toast.dismiss(loadingToast);
      showSuccess(t("success.videoUpdated"));

      await sendNotificationEmail(
        `🛠 Video actualizado para ${cliente?.email || uid}`,
        `El video "${updatedVideo.titulo}" ha sido actualizado.\nEstado: ${
          updatedVideo.estado === 0
            ? "Nuevo"
            : updatedVideo.estado === 1
            ? "Cambios"
            : "Aprobado"
        }\nNotas: ${updatedVideo.notas || "Sin notas"}`,
        t("errors.emailSend")
      );

      setVideoSeleccionado(null);
      fetchData();
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("errors.updateVideo"));
    }
  };

  const handleDelete = async (type: "guiones" | "videos", id: string) => {
    if (!uid || typeof uid !== "string") {
      handleError(null, t("errors.invalidUid"));
      return;
    }

    const loadingToast = showLoading(t("loading.deleting"));
    try {
      await deleteDoc(doc(db, "users", uid, type, id));
      toast.dismiss(loadingToast);
      showSuccess(t("success.deleted"));
      fetchData();
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("errors.delete"));
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!cliente) {
    return <div className="p-6 text-center">{t("notFound")}</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">
          {t("title", { email: cliente.email })}
        </h1>

        {cliente.stripeLink && (
          <a
            href={cliente.stripeLink}
            target="_blank"
            className="text-blue-600 underline"
          >
            {t("viewInStripe")}
          </a>
        )}

        {subscriptionPlan && (
          <div className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full w-fit">
            {t("subscriptionBadge", { plan: subscriptionPlan })}
          </div>
        )}
      </div>

      <ClienteDatosForm
        cliente={cliente}
        setCliente={setCliente}
        uid={uid as string}
        onSave={handleSaveCliente}
      />

      <GuionesSection
        guiones={guiones}
        modalOpen={modalGuionOpen}
        setModalOpen={setModalGuionOpen}
        onCreate={handleCreateGuion}
        onSelect={setGuionSeleccionado}
      />

      <VideosSection
        videos={videos}
        modalOpen={modalVideoOpen}
        setModalOpen={setModalVideoOpen}
        onUpload={(file, title) => {
          setArchivoVideo(file);
          setNuevoVideoTitulo(title);
          handleUploadVideo();
        }}
        uploadProgress={uploadProgress}
        archivoVideo={archivoVideo}
        setArchivoVideo={setArchivoVideo}
        nuevoTitulo={nuevoVideoTitulo}
        setNuevoTitulo={setNuevoVideoTitulo}
        onSelect={setVideoSeleccionado}
      />

      <EditarGuionModal
        guion={guionSeleccionado}
        onClose={() => setGuionSeleccionado(null)}
        onChange={setGuionSeleccionado}
        onDelete={(id) => handleDelete("guiones", id)}
        onSave={handleUpdateGuion}
      />

      <EditarVideoModal
        video={videoSeleccionado}
        onClose={() => setVideoSeleccionado(null)}
        onDelete={(id) => handleDelete("videos", id)}
        onSave={handleUpdateVideo}
      />

      <ClonacionVideosSection uid={uid as string} />

      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">{t("calendarTitle")}</h2>
        <CalendarioMensual uid={uid as string} guiones={guiones} videos={videos} />
      </div>
    </div>
  );
}
