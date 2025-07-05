"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { getDoc, updateDoc, doc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
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

export default function UserPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [instagramUser, setInstagramUser] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sub, setSub] = useState<StripeSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

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
    });

    return () => unsub();
  }, []);

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
          await updateDoc(doc(db, "users", userId), {
            photoURL: url,
          });
          setUserData((prev) => (prev ? { ...prev, photoURL: url } : null));
          toast.success("Foto de perfil subida y guardada");
        } catch {
          toast.error("Error guardando foto en base de datos");
        }
        setUploadingPhoto(false);
      }
    );
  };

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

  const handleInstagramUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val && !val.startsWith("@")) val = "@" + val;
    setInstagramUser(val);
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
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">Mi Panel de Usuario</h1>

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
    </div>
  );
}
