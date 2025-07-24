"use client";

import type { Video } from "@/types/video";
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
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ClienteDatosForm from "@/components/shared/clientdatosform";
import GuionesSection from "@/components/shared/guionesection";
import VideosSection from "@/components/shared/videosection";
import EditarGuionModal from "@/components/shared/editarguion";
import EditarVideoModal from "@/components/shared/editarvideo";
import ClonacionVideosSection from "@/components/shared/dropzonecl";
import CalendarioMensual from "@/components/shared/CalendarioMensual";

// 📧 Notificaciones
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

export default function ClientProfilePage() {
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

  const fetchSubscription = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/stripe/email?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      setSubscriptionPlan(json?.plan || "Sin plan");
    } catch {
      setSubscriptionPlan("Error");
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!uid) return toast.error("UID inválido.");
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) throw new Error("Cliente no encontrado.");
      const userData = userSnap.data() as Cliente;
      setCliente(userData);

      if (userData.email) fetchSubscription(userData.email);

      const guionesSnap = await getDocs(collection(userDocRef, "guiones"));
      setGuiones(guionesSnap.docs.map(doc => ({
        firebaseId: doc.id,
        ...doc.data()
      })) as Guion[]);

      const videosSnap = await getDocs(collection(userDocRef, "videos"));
      setVideos(videosSnap.docs.map(doc => ({
        firebaseId: doc.id,
        ...doc.data()
      })) as Video[]);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar la ficha del cliente.");
    } finally {
      setLoading(false);
    }
  }, [uid, fetchSubscription]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveCliente = async () => {
    if (!uid || !cliente) {
      toast.error("Faltan datos.");
      return;
    }
    try {
      await updateDoc(doc(db, "users", uid), cliente);
      toast.success("Datos actualizados.");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar.");
    }
  };

  const handleCreateGuion = async (titulo: string, contenido: string) => {
    if (!uid || !titulo || !contenido) return;
    try {
      await addDoc(collection(db, "users", uid, "guiones"), {
        titulo,
        contenido,
        estado: 0,
        creadoEn: new Date(),
      });
      toast.success("Guion creado.");
      await sendNotificationEmail(
        `📜 Nuevo guion creado para ${cliente?.email || uid}`,
        `Se ha creado un nuevo guion titulado: "${titulo}".`
      );
      setModalGuionOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Error al crear guion.");
    }
  };

  const handleUpdateGuion = async () => {
    if (!uid || !guionSeleccionado) return;
    try {
      const refDoc = doc(db, "users", uid, "guiones", guionSeleccionado.firebaseId);
      await updateDoc(refDoc, {
        titulo: guionSeleccionado.titulo,
        contenido: guionSeleccionado.contenido,
      });
      toast.success("Guion actualizado");
      setGuionSeleccionado(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar guion");
    }
  };

  const handleUploadVideo = async () => {
    if (!uid || !archivoVideo || !nuevoVideoTitulo.trim()) {
      toast.error("Completa todos los campos.");
      return;
    }

    if (archivoVideo.size > 100 * 1024 * 1024) {
      toast.error("El archivo no debe superar los 100MB.");
      return;
    }

    try {
      const storageRef = ref(storage, `users/${uid}/videos/${archivoVideo.name}`);
      const uploadTask = uploadBytesResumable(storageRef, archivoVideo);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        () => {
          toast.error("Error al subir el video.");
          setUploadProgress(null);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "users", uid, "videos"), {
            titulo: nuevoVideoTitulo,
            url,
            estado: "pendiente",
            creadoEn: new Date(),
          });
          toast.success("Video subido con éxito.");
          await sendNotificationEmail(
            `🎬 Nuevo video subido por ${cliente?.email || uid}`,
            `Se ha subido un nuevo video titulado: "${nuevoVideoTitulo}".`
          );
          setUploadProgress(null);
          setModalVideoOpen(false);
          setArchivoVideo(null);
          setNuevoVideoTitulo("");
          fetchData();
        }
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar video.");
      setUploadProgress(null);
    }
  };

  const handleUpdateVideo = async (updatedVideo: Video & { nuevoArchivo?: File }) => {
    if (!uid || !updatedVideo) return;

    try {
      let url = updatedVideo.url;

      if (updatedVideo.nuevoArchivo) {
        if (updatedVideo.nuevoArchivo.size > 100 * 1024 * 1024) {
          toast.error("El archivo no debe superar los 100MB.");
          return;
        }

        const storageRef = ref(storage, `users/${uid}/videos/${updatedVideo.nuevoArchivo.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, updatedVideo.nuevoArchivo);
        url = await getDownloadURL(uploadTask.ref);
      }

      await updateDoc(doc(db, "users", uid, "videos", updatedVideo.firebaseId), {
        titulo: updatedVideo.titulo,
        estado: updatedVideo.estado,
        notas: updatedVideo.notas || "",
        url,
      });

      toast.success("Video actualizado correctamente.");
      await sendNotificationEmail(
        `🛠 Video actualizado para ${cliente?.email || uid}`,
        `El video "${updatedVideo.titulo}" ha sido actualizado.\nEstado: ${updatedVideo.estado === 0 ? "Nuevo" : updatedVideo.estado === 1 ? "Cambios" : "Aprobado"}\nNotas: ${updatedVideo.notas || "Sin notas"}`
      );
      setVideoSeleccionado(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar video");
    }
  };

  const handleDelete = async (type: "guiones" | "videos", id: string) => {
    if (!uid || typeof uid !== "string") {
      toast.error("UID inválido.");
      return;
    }

    try {
      await deleteDoc(doc(db, "users", uid, type, id));
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar.");
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
    return <div className="p-6">Cliente no encontrado.</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">👤 Cliente: {cliente.email}</h1>
        {cliente.stripeLink && (
          <a href={cliente.stripeLink} target="_blank" className="text-blue-600 underline">
            Ver en Stripe
          </a>
        )}
        {subscriptionPlan && (
          <div className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full w-fit">
            {subscriptionPlan}
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
        <h2 className="text-2xl font-bold mb-4">📅 Calendario de Publicación</h2>
        <CalendarioMensual uid={uid as string} guiones={guiones} videos={videos} />
      </div>
    </div>
  );
}
