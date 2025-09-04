"use client";

import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import clsx from "clsx";

interface UserData {
  email: string;
  name?: string;
  instagramUser?: string;
  phone?: string;
  photoURL?: string;
}

interface Props {
  userId: string | null;
  userData: UserData | null;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
}

export default function UserProfile({ userId, userData, setUserData }: Props) {
  const [name, setName] = useState(userData?.name ?? "");
  const [instagramUser, setInstagramUser] = useState(userData?.instagramUser ?? "");
  const [phone, setPhone] = useState(userData?.phone ?? "");
  const [photoURL, setPhotoURL] = useState(userData?.photoURL ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoClick = () => {
    if (fileInputRef.current && !uploadingPhoto) fileInputRef.current.click();
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
    const photoRef = ref(storage, `users/${userId}/profile_photo_${Date.now()}`);
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
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setPhotoURL(url);

          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) throw new Error("No autenticado");

          // 🔹 Usamos la API CRUD
          const res = await fetch(`/api/firebase/users/${userId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ photoURL: url }),
          });

          if (!res.ok) throw new Error(`Error ${res.status}`);
          setUserData((prev) => (prev ? { ...prev, photoURL: url } : null));
          toast.success("Foto de perfil subida y guardada");
        } catch (err) {
          console.error("Error guardando foto:", err);
          toast.error("Error guardando foto en base de datos");
        } finally {
          setUploadingPhoto(false);
        }
      }
    );
  };

  const saveUserData = async () => {
    if (!userId) {
      toast.error("Usuario no autenticado");
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado");

      const body = {
        name: name.trim(),
        instagramUser: instagramUser.trim(),
        phone: phone.trim(),
      };

      // 🔹 Usamos la API CRUD
      const res = await fetch(`/api/firebase/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      setUserData((prev) => (prev ? { ...prev, ...body } : null));
      toast.success("Datos actualizados correctamente");
    } catch (err) {
      console.error("Error guardando datos:", err);
      toast.error("Error guardando datos");
    }
  };


  const handleInstagramUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val && !val.startsWith("@")) val = "@" + val;
    setInstagramUser(val);
  };

  return (
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
  );
}

