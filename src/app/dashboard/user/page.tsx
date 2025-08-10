"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import clsx from "clsx";
import Image from "next/image";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import toast from "react-hot-toast";
import { logAction } from "@/lib/logs";
import { useTranslations } from "next-intl";

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

const MAX_VIDEOS = 3;

export default function UserPanel() {
  const t = useTranslations("userPage");

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
  const [dragActive, setDragActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ClonacionVideo | null>(null);
  const [editTitles, setEditTitles] = useState<Record<string, string>>({});

  // Modal eliminar vídeo
  const [videoToDelete, setVideoToDelete] = useState<ClonacionVideo | null>(null);

  // Progreso de subida de videos
  const [videoUploadProgress, setVideoUploadProgress] = useState<Record<string, number>>({});

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const dragDropRef = useRef<HTMLDivElement | null>(null);

  // Verificar límite
  const videoLimitReached = clonacionVideos.length >= MAX_VIDEOS;

  const loadClonacionVideos = useCallback(
    async (uid: string) => {
      setLoadingVideos(true);
      try {
        const q = query(
          collection(db, "users", uid, "clonacion"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const videos: ClonacionVideo[] = [];
        querySnapshot.forEach((d) => {
          const data = d.data() as { titulo?: string; url: string; storagePath: string };
          videos.push({
            id: d.id,
            titulo: data.titulo ?? t("cloning.upload.none"),
            url: data.url,
            storagePath: data.storagePath,
          });
        });
        setClonacionVideos(videos);
        setEditTitles(videos.reduce((acc, v) => ({ ...acc, [v.id]: v.titulo }), {}));
      } catch (error) {
        handleError(error, t("cloning.upload.loadingVideos"));
      } finally {
        setLoadingVideos(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        handleError(null, t("profile.authRequired"));
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
      } catch (error) {
        handleError(error, t("profile.actions.saveError"));
      }

      try {
        setLoadingSub(true);
        const token = await user.getIdToken();
        const res = await fetch("/api/stripe/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(t("subscription.loading"));
        const data = await res.json();
        setSub(data);
      } catch (error) {
        handleError(error, t("subscription.loading"));
      } finally {
        setLoadingSub(false);
      }

      loadClonacionVideos(user.uid);
    });

    return () => unsub();
  }, [loadClonacionVideos, t]);

  // User profile photo
  const handlePhotoClick = () => {
    if (fileInputRef.current && !uploadingPhoto) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      handleError(null, t("profile.photo.onlyImages"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      handleError(null, t("profile.photo.maxSize"));
      return;
    }
    if (!userId) {
      handleError(null, t("profile.authRequired"));
      return;
    }

    setUploadingPhoto(true);
    const loadingToast = showLoading(t("profile.photo.uploadLoading"));

    const photoRef = storageRef(storage, `users/${userId}/profile_photo_${Date.now()}`);
    const uploadTask = uploadBytesResumable(photoRef, file);
    uploadTask.on(
      "state_changed",
      () => {},
      (error) => {
        toast.dismiss(loadingToast);
        handleError(error, t("profile.photo.uploadError"));
        setUploadingPhoto(false);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setPhotoURL(url);
          await updateDoc(doc(db, "users", userId), { photoURL: url });
          setUserData((prev) => (prev ? { ...prev, photoURL: url } : null));
          toast.dismiss(loadingToast);
          showSuccess(t("profile.photo.updated"));
        } catch (error) {
          toast.dismiss(loadingToast);
          handleError(error, t("profile.photo.saveToDbError"));
        }
        setUploadingPhoto(false);
      }
    );
  };

  // Save user info
  const saveUserData = async () => {
    if (!userId) {
      handleError(null, t("profile.authRequired"));
      return;
    }
    try {
      await updateDoc(doc(db, "users", userId), {
        name: name.trim(),
        instagramUser: instagramUser.trim(),
        phone: phone.trim(),
      });
      showSuccess(t("profile.actions.saved"));
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
    } catch (error) {
      handleError(error, t("profile.actions.saveError"));
    }
  };

  // Instagram input enforcement
  const handleInstagramUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val && !val.startsWith("@")) val = "@" + val;
    setInstagramUser(val);
  };

  // Drag & drop handlers
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
      handleError(null, t("profile.authRequired"));
      return;
    }

    if (videoLimitReached) {
      handleError(null, t("cloning.dropzone.limitReachedTitle"));
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const availableSlots = MAX_VIDEOS - clonacionVideos.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    if (filesToUpload.length < files.length) {
      handleError(null, t("cloning.upload.slotsWarning", { count: availableSlots }));
    }

    for (const file of filesToUpload) {
      if (!file.type.startsWith("video/")) {
        handleError(null, t("cloning.upload.onlyVideos"));
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        handleError(null, t("cloning.upload.maxSize"));
        continue;
      }

      const randomId = Math.random().toString(36).substring(2, 10);
      const ext = file.name.split(".").pop() ?? "mp4";
      const title = `${userId}_${randomId}`;
      uploadVideo(file, title, ext);
    }
  };

  // Upload video
  const uploadVideo = (file: File, title: string, ext: string) => {
    if (!userId || videoLimitReached) return;

    const fileKey = `${title}.${ext}`;
    setVideoUploadProgress((prev) => ({ ...prev, [fileKey]: 0 }));

    const loadingToast = showLoading(t("cloning.upload.uploadingFile", { name: file.name }));

    const videoPath = `users/${userId}/clonacion/${title}.${ext}`;
    const videoRef = storageRef(storage, videoPath);

    const uploadTask = uploadBytesResumable(videoRef, file);
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setVideoUploadProgress((prev) => ({ ...prev, [fileKey]: prog }));
      },
      (error) => {
        toast.dismiss(loadingToast);
        handleError(error, t("cloning.upload.uploadError", { name: file.name }));
        setVideoUploadProgress((prev) => {
          const newState = { ...prev };
          delete newState[fileKey];
          return newState;
        });
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
          toast.dismiss(loadingToast);
          showSuccess(t("cloning.upload.success", { name: file.name }));

          try {
            await logAction({
              type: "clonacion",
              action: "subido",
              uid: userId,
              admin: userData?.email || "Cliente",
              targetId: docRef.id,
              message: `Cliente ${userData?.email || userData?.name || "Usuario"} subió material de clonación`,
            });
          } catch {
            // Silencioso: no romper flujo si el log falla
          }

          // Asignar tarea
          try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("No auth");

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
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.message || "Server error");
            }
          } catch (error) {
            handleError(error, t("cloning.upload.createTaskError"));
          }
        } catch (error) {
          toast.dismiss(loadingToast);
          handleError(error, t("cloning.upload.saveError"));
        } finally {
          setVideoUploadProgress((prev) => {
            const newState = { ...prev };
            delete newState[fileKey];
            return newState;
          });
        }
      }
    );
  };

  // Delete with modal
  const confirmDeleteVideo = (video: ClonacionVideo) => {
    setVideoToDelete(video);
  };

  const cancelDelete = () => {
    setVideoToDelete(null);
  };

  const handleDeleteVideo = async () => {
    if (!userId || !videoToDelete) {
      handleError(null, t("cloning.delete.notSelectedOrAuth"));
      setVideoToDelete(null);
      return;
    }

    const loadingToast = showLoading(t("cloning.delete.deleting"));

    try {
      await deleteDoc(doc(db, "users", userId, "clonacion", videoToDelete.id));
      const vidRef = storageRef(storage, videoToDelete.storagePath);
      await deleteObject(vidRef);
      setClonacionVideos((prev) => prev.filter((v) => v.id !== videoToDelete.id));
      toast.dismiss(loadingToast);
      showSuccess(t("cloning.delete.success"));
      if (selectedVideo?.id === videoToDelete.id) setSelectedVideo(null);
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("cloning.delete.error"));
    } finally {
      setVideoToDelete(null);
    }
  };

  const getStatusChipStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
      case "trialing":
        return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
      case "past_due":
        return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
      case "unpaid":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
      case "canceled":
        return "bg-gray-200 text-gray-600 border-gray-300 dark:bg-muted dark:text-muted-foreground dark:border-border";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300 dark:bg-muted dark:text-muted-foreground dark:border-border";
    }
  };

  // ✅ Sin "as any": resolvemos el label con switch
  const renderStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return t("subscription.statusMap.active");
      case "trialing":
        return t("subscription.statusMap.trialing");
      case "past_due":
        return t("subscription.statusMap.past_due");
      case "unpaid":
        return t("subscription.statusMap.unpaid");
      case "canceled":
        return t("subscription.statusMap.canceled");
      default:
        return status;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

      {/* Datos del usuario */}
      <section className="border border-border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
        <h2 className="text-xl font-semibold mb-4">{t("profile.sectionTitle")}</h2>

        <div className="flex items-center gap-6 mb-6">
          <div
            className={clsx(
              "relative w-28 h-28 rounded-full overflow-hidden border cursor-pointer select-none",
              uploadingPhoto ? "opacity-60" : "opacity-100",
              "border-border"
            )}
            onClick={handlePhotoClick}
            title={uploadingPhoto ? t("profile.photo.uploadingTooltip") : t("profile.photo.changeTooltip")}
            aria-label={t("profile.photo.changeTooltip")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handlePhotoClick();
            }}
          >
            {photoURL ? (
              <Image
                src={photoURL}
                alt="Profile photo"
                fill
                style={{ objectFit: "cover" }}
                sizes="112px"
                priority={false}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground text-4xl font-bold">
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
              <Label htmlFor="name">{t("profile.labels.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("profile.placeholders.name")}
              />
            </div>

            <div>
              <Label htmlFor="instagramUser">{t("profile.labels.instagramUser")}</Label>
              <Input
                id="instagramUser"
                value={instagramUser}
                onChange={handleInstagramUserChange}
                placeholder={t("profile.placeholders.instagramUser")}
              />
            </div>

            <div>
              <Label htmlFor="phone">{t("profile.labels.phone")}</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("profile.placeholders.phone")}
              />
            </div>

            <div>
              <Label>{t("profile.labels.emailReadonly")}</Label>
              <Input value={userData?.email ?? ""} disabled />
            </div>

            <Button onClick={saveUserData} disabled={uploadingPhoto}>
              {uploadingPhoto ? t("profile.actions.savingPhoto") : t("profile.actions.save")}
            </Button>
          </div>
        </div>
      </section>

      {/* Suscripción */}
      <section className="border border-border rounded-lg p-4 bg-card text-card-foreground shadow-sm">
        <h2 className="text-xl font-semibold mb-4">{t("subscription.sectionTitle")}</h2>

        {loadingSub ? (
          <p className="text-muted-foreground animate-pulse">{t("subscription.loading")}</p>
        ) : sub ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("subscription.labels.status")}:</span>
              <span
                className={clsx(
                  "px-3 py-1 rounded-full text-sm border",
                  getStatusChipStyle(sub.status)
                )}
              >
                {renderStatusLabel(sub.status)}
              </span>
            </div>

            <p>
              <strong>{t("subscription.labels.plan")}:</strong> {sub.plan}
            </p>
            <p>
              <strong>{t("subscription.labels.price")}:</strong>{" "}
              {sub.amount
                ? `${sub.amount.toFixed(2)} ${sub.currency.toUpperCase()} / ${sub.interval}`
                : t("common.unknown")}
            </p>
            <p>
              <strong>{t("subscription.labels.renewal")}:</strong>{" "}
              {sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toLocaleDateString()
                : t("common.unknown")}
            </p>
            <p>
              <strong>{t("subscription.labels.cancelAtPeriodEnd")}:</strong>{" "}
              {sub.cancel_at_period_end ? t("subscription.yes") : t("subscription.no")}
            </p>

            <Button className="mt-4" asChild>
              <a
                href="https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("subscription.openBillingPortal")}
              </a>
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("subscription.noActive")}</p>
        )}
      </section>

      {/* Vídeos de Clonación */}
      <section className="border border-border rounded-lg p-6 bg-card text-card-foreground shadow-sm relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t("cloning.sectionTitle")}</h2>
          <div
            className={clsx(
              "px-3 py-1 rounded-full text-sm font-medium border",
              videoLimitReached
                ? "bg-primary/10 text-primary border-primary"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            {t("cloning.limitBadge", { count: clonacionVideos.length, max: MAX_VIDEOS })}
          </div>
        </div>

        <div
          ref={dragDropRef}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!videoLimitReached) {
              videoInputRef.current?.click();
            }
          }}
          className={clsx(
            "border-2 border-dashed rounded p-8 text-center cursor-pointer select-none transition-all",
            "bg-muted",
            dragActive && !videoLimitReached
              ? "ring-2 ring-primary/40 border-primary bg-accent"
              : videoLimitReached
              ? "border-primary bg-primary/10"
              : "border-border"
          )}
          aria-label={
            videoLimitReached
              ? t("cloning.dropzone.aria.limitReached")
              : t("cloning.dropzone.aria.dropArea")
          }
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (!videoLimitReached) {
                videoInputRef.current?.click();
              }
            }
          }}
        >
          {videoLimitReached ? (
            <div className="text-primary font-medium">
              <p>{t("cloning.dropzone.limitReachedTitle")}</p>
              <p className="text-sm mt-2 text-muted-foreground">
                {t("cloning.dropzone.limitReachedSubtitle", { max: MAX_VIDEOS })}
              </p>
            </div>
          ) : Object.keys(videoUploadProgress).length > 0 ? (
            <div className="space-y-3 w-full max-w-md mx-auto">
              {Object.entries(videoUploadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-1">
                  <p className="text-sm truncate">
                    {fileName.split(".")[0]} - {progress.toFixed(0)}%
                  </p>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">{t("cloning.dropzone.placeholder")}</p>
          )}

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            multiple
            disabled={videoLimitReached}
            onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              if (!userId) {
                handleError(null, t("profile.authRequired"));
                return;
              }

              const availableSlots = MAX_VIDEOS - clonacionVideos.length;
              const filesToUpload = Array.from(files).slice(0, availableSlots);

              if (filesToUpload.length < files.length) {
                handleError(null, t("cloning.upload.slotsWarning", { count: availableSlots }));
              }

              filesToUpload.forEach((file) => {
                if (!file.type.startsWith("video/")) {
                  handleError(null, t("cloning.upload.onlyVideos"));
                  return;
                }
                if (file.size > 100 * 1024 * 1024) {
                  handleError(null, t("cloning.upload.maxSize"));
                  return;
                }
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
            <p className="text-muted-foreground">{t("cloning.upload.loadingVideos")}</p>
          ) : clonacionVideos.length === 0 ? (
            <p className="text-muted-foreground">{t("cloning.upload.none")}</p>
          ) : (
            clonacionVideos.map((video) => (
              <div
                key={video.id}
                className="relative cursor-pointer rounded border border-border overflow-hidden shadow hover:shadow-lg"
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
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
                  aria-label={t("cloning.grid.aria.deleteVideo", { title: video.titulo })}
                >
                  ×
                </button>

                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate select-none">
                  {editTitles[video.id] ?? video.titulo}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal confirm delete */}
        {videoToDelete && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            aria-modal="true"
            role="dialog"
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
          >
            <div className="bg-popover text-popover-foreground rounded-lg p-6 max-w-md w-full border border-border shadow-lg">
              <h3 id="modal-title" className="text-lg font-semibold mb-4">
                {t("cloning.deleteModal.title")}
              </h3>
              <p id="modal-desc" className="mb-6 text-muted-foreground">
                {t("cloning.deleteModal.body", { title: videoToDelete.titulo })}
              </p>
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={cancelDelete}>
                  {t("cloning.deleteModal.cancel")}
                </Button>
                <Button variant="destructive" onClick={handleDeleteVideo}>
                  {t("cloning.deleteModal.delete")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {selectedVideo && (
          <div
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-50"
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
              aria-label={t("cloning.grid.aria.closeVideo")}
            >
              ×
            </button>
            <video
              src={selectedVideo.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded"
            />
            <p className="text-white mt-2">
              {editTitles[selectedVideo.id] ?? selectedVideo.titulo}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
