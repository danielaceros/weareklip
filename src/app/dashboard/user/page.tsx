"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useUserPanel } from "@/components/user/useUserPanel";
import UserProfileSection from "@/components/user/UserProfileSection";

import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";

export default function UserPage() {
  const { t } = useUserPanel();

  const [fbUser, setFbUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [instagramUser, setInstagramUser] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [userData, setUserData] = useState<{ email?: string } | null>(null);

  // 👇 ajuste de tipo: ref nullable
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar datos del perfil
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (!u) return;

      setUserData({ email: u.email ?? "" });

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef).catch(() => null);
      const data = snap?.exists() ? (snap.data() as any) : {};

      setName(data?.displayName ?? data?.name ?? "");
      setInstagramUser(data?.instagramUser ?? data?.instagram ?? "");
      setPhone(data?.phone ?? "");
      setPhotoURL(data?.photoURL ?? u.photoURL ?? null);
    });
    return () => unsub();
  }, []);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fbUser) return;

    try {
      setUploadingPhoto(true);
      const path = `users/${fbUser.uid}/avatar_${Date.now()}.jpg`;
      const sref = ref(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);

      const userRef = doc(db, "users", fbUser.uid);
      await setDoc(userRef, { photoURL: url }, { merge: true });

      setPhotoURL(url);
      toast.success("Foto actualizada");
    } catch (err) {
      console.error(err);
      toast.error("Error al subir la foto");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveUserData = async () => {
    if (!fbUser) return;
    const userRef = doc(db, "users", fbUser.uid);
    await setDoc(
      userRef,
      {
        displayName: name,
        instagramUser,
        phone,
      },
      { merge: true }
    );
  };

  const handleInstagramUserChange = (e: ChangeEvent<HTMLInputElement>) => setInstagramUser(e.target.value);

  return (
    <div className="space-y-8">
      <UserProfileSection
        t={t}
        name={name}
        setName={setName}
        instagramUser={instagramUser}
        handleInstagramUserChange={handleInstagramUserChange}
        phone={phone}
        setPhone={setPhone}
        userData={userData}
        uploadingPhoto={uploadingPhoto}
        fileInputRef={fileInputRef}
        handlePhotoClick={handlePhotoClick}
        handlePhotoChange={handlePhotoChange}
        photoURL={photoURL}
        saveUserData={saveUserData}
      />
    </div>
  );
}
