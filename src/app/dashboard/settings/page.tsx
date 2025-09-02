"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import {
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  // 🔹 Perfil extendido
  const [displayName, setDisplayName] = useState("");
  const [instagramUser, setInstagramUser] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
      } else {
        setUser(u);
        setDisplayName(u.displayName ?? "");

        // 🔹 Cargar datos de Firestore
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef).catch(() => null);
        const data = snap?.exists() ? (snap.data() as any) : {};

        setInstagramUser(data?.instagramUser ?? "");
        setPhone(data?.phone ?? "");
        setPhotoURL(data?.photoURL ?? u.photoURL ?? null);
      }
    });
    return () => unsub();
  }, [router]);

  // Guardar perfil (Auth + Firestore)
  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName });
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        { displayName, instagramUser, phone },
        { merge: true }
      );
      toast.success(t("settings.savedProfile"));
    } catch (e) {
      console.error(e);
      toast.error(t("settings.errorProfile"));
    }
  };

  // Subir nueva foto
  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploadingPhoto(true);
      const path = `users/${user.uid}/avatar_${Date.now()}.jpg`;
      const sref = ref(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);

      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { photoURL: url }, { merge: true });

      setPhotoURL(url);
      toast.success("📸 Foto actualizada");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error subiendo la foto");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success(t("settings.resetPasswordSent"));
    } catch (e) {
      console.error(e);
      toast.error(t("settings.errorResetPassword"));
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm(t("settings.confirmDelete"))) return;
    try {
      await deleteUser(user);
      toast.success(t("settings.accountDeleted"));
      router.push("/login");
    } catch (e) {
      console.error(e);
      toast.error(t("settings.errorDeleteAccount"));
    }
  };

  return (
    <div className="space-y-8 px-4 sm:px-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* Perfil extendido */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.profile")}</h2>

        {/* Foto */}
        <div className="flex items-center gap-4">
          <img
            src={photoURL ?? "/default-avatar.png"}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover border"
          />
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? "Subiendo..." : "Cambiar foto"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        {/* Nombre + Email */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("settings.name")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
        </div>

        {/* Instagram + Teléfono */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Instagram</Label>
            <Input
              value={instagramUser}
              onChange={(e) => setInstagramUser(e.target.value)}
              placeholder="@usuario"
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="w-full sm:w-auto" onClick={handleSaveProfile}>
            {t("settings.save")}
          </Button>
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={handleResetPassword}
          >
            {t("settings.resetPassword")}
          </Button>
        </div>
      </Card>

      {/* Suscripción */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.subscription")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.subscriptionDesc")}
        </p>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              "https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00",
              "_blank"
            )
          }
        >
          {t("settings.manageSubscription")}
        </Button>

        <Button
          variant="destructive"
          onClick={handleDeleteAccount}
          className="mt-4"
        >
          ❌ {t("settings.deleteAccount")}
        </Button>
      </Card>
    </div>
  );
}
