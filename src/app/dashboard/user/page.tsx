"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase";
import {
  getDoc,
  updateDoc,
  doc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
  deleteObject,
} from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import clsx from "clsx";
import Image from "next/image";

interface StripeSubscription {
  status: string;
  plan: string;
  current_period_end: number | null;
  amount: number | null;
  interval: string;
  currency: string;
  cancel_at_period_end: boolean;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    } | null;
    created: string | null;
  };
}

interface UserData {
  email: string;
  name?: string;
  instagramUser?: string;
  phone?: string;
  photoURL?: string;
}

interface ClonacionVideo {
  id: string;
  titulo: string;
  url: string;
  storagePath: string;
}

export default function UserPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Editable user fields
  const [name, setName] = useState("");
  const [instagramUser, setInstagramUser] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscription
  const [sub, setSub] = useState<StripeSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  // Clonacion videos state
  const [clonacionVideos, setClonacionVideos] = useState<ClonacionVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ClonacionVideo | null>(null);
  const [editTitles, setEditTitles] = useState<Record<string, string>>({});

  // Modal eliminar vídeo
  const [videoToDelete, setVideoToDelete] = useState<ClonacionVideo | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const dragDropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast.error("No autenticado", { description: "Inicia sesión para ver tu panel." });
        return;
      }

      setUserId(user.uid);

      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data() as UserData;
          setUserData(data);

          setName(data.name ?? "");
          setInstagramUser(data.instagramUser ?? "");
          setPhone(data.phone ?? "");
          setPhotoURL(data.photoURL ?? "");
        } else {
          setUserData(null);
        }
      } catch {
        toast.error("Error cargando datos de usuario.");
      }

      try {
        setLoadingSub(true);
        const token = await user.getIdToken();
        const res = await fetch("/api/stripe/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("No se pudo obtener la suscripción");
        const data = await res.json();
        setSub(data);
      } catch {
        toast.error("Error cargando suscripción.");
      } finally {
        setLoadingSub(false);
      }

      loadClonacionVideos(user.uid);
    });

    return () => unsub();
  }, []);

  const loadClonacionVideos = async (uid: string) => {
    setLoadingVideos(true);
    try {
      const q = query(collection(db, "users", uid, "clonacion"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const videos: ClonacionVideo[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        videos.push({
          id: doc.id,
          titulo: data.titulo ?? "Sin título",
          url: data.url,
          storagePath: data.storagePath,
        });
      });
      setClonacionVideos(videos);
      setEditTitles(videos.reduce((acc, v) => ({ ...acc, [v.id]: v.titulo }), {}));
    } catch (error) {
      console.error("Error cargando videos clonacion:", error);
      toast.error("Error cargando videos de clonación.");
    } finally {
      setLoadingVideos(false);
    }
  };

  // User profile photo handlers
  const handlePhotoClick = () => {
    if (fileInputRef.current && !uploadingPhoto) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Solo imágenes permitidas para la foto de perfil.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 5MB.");
      return;
    }
    if (!userId) {
      toast.error("Usuario no autenticado");
      return;
    }
    setUploadingPhoto(true);
    const photoRef = storageRef(storage, `users/${userId}/profile_photo_${Date.now()}`);
    const uploadTask = uploadBytesResumable(photoRef, file);
    uploadTask.on(
      "state_changed",
      () => {},
      (error) => {
        console.error("Error subiendo foto:", error);
        toast.error("Error subiendo foto de perfil.");
        setUploadingPhoto(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setPhotoURL(url);
        try {
          await updateDoc(doc(db, "users", userId), { photoURL: url });
          setUserData((prev) => (prev ? { ...prev, photoURL: url } : null));
          toast.success("Foto de perfil subida y guardada");
        } catch {
          toast.error("Error guardando foto en base de datos");
        }
        setUploadingPhoto(false);
      }
    );
  };

  // Save user info
  const saveUserData = async () => {
    if (!userId) {
      toast.error("Usuario no autenticado");
      return;
    }
    try {
      await updateDoc(doc(db, "users", userId), {
        name: name.trim(),
        instagramUser: instagramUser.trim(),
        phone: phone.trim(),
      });
      toast.success("Datos actualizados correctamente");
      setUserData((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
              instagramUser: instagramUser.trim(),
              phone: phone.trim(),
            }
          : null
      );
    } catch {
      toast.error("Error guardando datos");
    }
  };

  // Instagram input enforcement
  const handleInstagramUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val && !val.startsWith("@")) val = "@" + val;
    setInstagramUser(val);
  };

  // Drag and drop handlers for video upload
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!userId) {
      toast.error("Usuario no autenticado");
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) {
        toast.error("Solo archivos de vídeo permitidos.");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error("El vídeo debe ser menor a 100MB.");
        return;
      }
    }

    Array.from(files).forEach((file) => {
      // El título es uid_randomid, sin pedir nada
      const randomId = Math.random().toString(36).substring(2, 10);
      const ext = file.name.split(".").pop() ?? "mp4";
      const title = `${userId}_${randomId}`;
      uploadVideo(file, title, ext);
    });
  };

  // Upload video to Firebase Storage + Firestore with uid_random.ext naming
 const uploadVideo = (file: File, title: string, ext: string) => {
  if (!userId) return;
  setUploadingVideo(true);
  setVideoUploadProgress(0);

  const videoPath = `users/${userId}/clonacion/${title}.${ext}`;
  const videoRef = storageRef(storage, videoPath);

  const uploadTask = uploadBytesResumable(videoRef, file);
  uploadTask.on(
    "state_changed",
    (snapshot) => {
      const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      setVideoUploadProgress(prog);
    },
    (error) => {
      console.error("Error subiendo video:", error);
      toast.error("Error subiendo video.");
      setUploadingVideo(false);
    },
    async () => {
      try {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        const docRef = await addDoc(collection(db, "users", userId, "clonacion"), {
          titulo: title,
          url,
          storagePath: videoPath,
          createdAt: Date.now(),
        });
        setClonacionVideos((prev) => [
          { id: docRef.id, titulo: title, url, storagePath: videoPath },
          ...prev,
        ]);
        setEditTitles((prev) => ({ ...prev, [docRef.id]: title }));
        toast.success("Vídeo subido correctamente.");

        // AQUÍ ESTÁ LA NUEVA FUNCIONALIDAD
        // Asignar tarea a Rubén después de subir el video
        try {
          const token = await auth.currentUser?.getIdToken();
          if (!token) throw new Error("No autenticado");

          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              description: "📥 Revisar nuevo material de clonación subido",
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Error en la respuesta del servidor");
          }

          const data = await res.json();
          console.log("Tarea asignada:", data);
        } catch (error) {
          console.error("Error al asignar tarea:", error);
          toast.error("Error al crear tarea de revisión", {
            description: "El video se subió, pero no se pudo asignar la tarea automática",
          });
        }

      } catch (e) {
        console.error(e);
        toast.error("Error guardando video en base de datos.");
      }
      setUploadingVideo(false);
      setVideoUploadProgress(0);
    }
  );
};
  // Handle delete with modal confirmation
  const confirmDeleteVideo = (video: ClonacionVideo) => {
    setVideoToDelete(video);
  };

  const cancelDelete = () => {
    setVideoToDelete(null);
  };

  const handleDeleteVideo = async () => {
    if (!userId || !videoToDelete) {
      toast.error("Usuario no autenticado o vídeo no seleccionado");
      setVideoToDelete(null);
      return;
    }

    try {
      await deleteDoc(doc(db, "users", userId, "clonacion", videoToDelete.id));
      const videoRef = storageRef(storage, videoToDelete.storagePath);
      await deleteObject(videoRef);
      setClonacionVideos((prev) => prev.filter((v) => v.id !== videoToDelete.id));
      toast.success("Vídeo eliminado correctamente.");
      if (selectedVideo?.id === videoToDelete.id) setSelectedVideo(null);
    } catch (e) {
      console.error(e);
      toast.error("Error eliminando vídeo.");
    } finally {
      setVideoToDelete(null);
    }
  };

  const getStatusChipStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300";
      case "trialing":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "past_due":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "unpaid":
        return "bg-red-100 text-red-700 border-red-300";
      case "canceled":
        return "bg-gray-200 text-gray-600 border-gray-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">Mi Panel de Usuario</h1>

      {/* Datos del usuario */}
      <section className="border rounded-lg p-6 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Datos del Usuario</h2>

        <div className="flex items-center gap-6 mb-6">
          <div
            className={clsx(
              "relative w-28 h-28 rounded-full overflow-hidden border border-gray-300 cursor-pointer select-none",
              uploadingPhoto ? "opacity-60" : "opacity-100"
            )}
            onClick={handlePhotoClick}
            title={uploadingPhoto ? "Subiendo foto..." : "Clic para cambiar foto"}
            aria-label="Subir foto de perfil"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handlePhotoClick();
            }}
          >
            {photoURL ? (
              <Image
                src={photoURL}
                alt="Foto de perfil"
                fill
                style={{ objectFit: "cover" }}
                sizes="112px"
                priority={false}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-gray-200 text-gray-400 text-4xl font-bold">
                {name ? name[0].toUpperCase() : "?"}
              </div>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            disabled={uploadingPhoto}
          />

          <div className="flex-1 space-y-4">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
              />
            </div>

            <div>
              <Label htmlFor="instagramUser">Usuario Instagram</Label>
              <Input
                id="instagramUser"
                value={instagramUser}
                onChange={handleInstagramUserChange}
                placeholder="@usuario"
              />
            </div>

            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 123 456"
              />
            </div>

            <div>
              <Label>Email (no editable)</Label>
              <Input value={userData?.email ?? ""} disabled />
            </div>

            <Button onClick={saveUserData} disabled={uploadingPhoto}>
              {uploadingPhoto ? "Subiendo foto..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </section>

      {/* Suscripción */}
      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Mi Suscripción</h2>

        {loadingSub ? (
          <p className="text-muted-foreground animate-pulse">Cargando suscripción...</p>
        ) : sub ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Estado:</span>
              <span
                className={clsx(
                  "px-3 py-1 rounded-full text-sm border",
                  getStatusChipStyle(sub.status)
                )}
              >
                {sub.status}
              </span>
            </div>

            <p>
              <strong>Plan:</strong> {sub.plan}
            </p>
            <p>
              <strong>Precio:</strong>{" "}
              {sub.amount
                ? `${sub.amount.toFixed(2)} ${sub.currency.toUpperCase()} / ${sub.interval}`
                : "No disponible"}
            </p>
            <p>
              <strong>Renovación:</strong>{" "}
              {sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toLocaleDateString("es-ES")
                : "No disponible"}
            </p>
            <p>
              <strong>Cancelación al final del periodo:</strong>{" "}
              {sub.cancel_at_period_end ? "Sí" : "No"}
            </p>

            <Button className="mt-4" asChild>
              <a
                href="https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir portal de facturación
              </a>
            </Button>
          </div>
        ) : (
          <p>No tienes suscripción activa.</p>
        )}
      </section>

      {/* Sección vídeos clonacion */}
      <section className="border rounded-lg p-6 bg-white shadow-sm relative">
        <h2 className="text-xl font-semibold mb-4">Mis Vídeos de Clonación</h2>

        <div
          ref={dragDropRef}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => videoInputRef.current?.click()}
          className={clsx(
            "border-2 border-dashed rounded p-8 text-center cursor-pointer select-none",
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
          )}
          aria-label="Área de arrastrar y soltar vídeos para subir"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") videoInputRef.current?.click();
          }}
        >
          {uploadingVideo ? (
            <p>Subiendo vídeo... {videoUploadProgress.toFixed(0)}%</p>
          ) : (
            <p>Arrastra y suelta aquí tus vídeos o haz clic para seleccionar</p>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              if (!userId) {
                toast.error("Usuario no autenticado");
                return;
              }
              Array.from(files).forEach((file) => {
                if (!file.type.startsWith("video/")) {
                  toast.error("Solo archivos de vídeo permitidos.");
                  return;
                }
                if (file.size > 100 * 1024 * 1024) {
                  toast.error("El vídeo debe ser menor a 100MB.");
                  return;
                }
                // Generar título automáticamente
                const randomId = Math.random().toString(36).substring(2, 10);
                const ext = file.name.split(".").pop() ?? "mp4";
                const title = `${userId}_${randomId}`;
                uploadVideo(file, title, ext);
              });
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {loadingVideos ? (
            <p>Cargando vídeos...</p>
          ) : clonacionVideos.length === 0 ? (
            <p>No tienes vídeos subidos.</p>
          ) : (
            clonacionVideos.map((video) => (
              <div
                key={video.id}
                className="relative cursor-pointer rounded border overflow-hidden shadow hover:shadow-lg"
                style={{ aspectRatio: "1 / 1" }}
              >
                <video
                  src={video.url}
                  muted
                  preload="metadata"
                  onClick={() => setSelectedVideo(video)}
                  className="w-full h-full object-cover rounded"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedVideo(video);
                  }}
                />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDeleteVideo(video);
                  }}
                  className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
                  aria-label={`Eliminar video ${video.titulo}`}
                >
                  ×
                </button>

                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate select-none">
                  {editTitles[video.id] ?? video.titulo}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de confirmación eliminación */}
        {videoToDelete && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            aria-modal="true"
            role="dialog"
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
          >
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
              <h3 id="modal-title" className="text-lg font-semibold mb-4">
                Confirmar eliminación
              </h3>
              <p id="modal-desc" className="mb-6">
                ¿Seguro que quieres eliminar el vídeo{" "}
                <strong>{videoToDelete.titulo}</strong>?
              </p>
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={cancelDelete}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteVideo}>
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para vídeo seleccionado grande */}
        {selectedVideo && (
          <div
            className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center p-4 z-50"
            onClick={() => setSelectedVideo(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="self-end mb-2 text-white text-3xl font-bold focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedVideo(null);
              }}
              aria-label="Cerrar video"
            >
              ×
            </button>
            <video
              src={selectedVideo.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded"
            />
            <p className="text-white mt-2">{editTitles[selectedVideo.id] ?? selectedVideo.titulo}</p>
          </div>
        )}
      </section>
    </div>
  );
}
