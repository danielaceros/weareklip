"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  LOCALES,
  type Locale,
  useT,
  changeLocale,
  getStoredLocale,
} from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocaleState] = useState<Locale>("es");

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifWhatsApp, setNotifWhatsApp] = useState(false);

  const [shareData, setShareData] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState(true);

  const [twoFactor, setTwoFactor] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
      } else {
        setUser(u);
        setDisplayName(u.displayName ?? "");
      }
    });
    setLocaleState(getStoredLocale());
    return () => unsub();
  }, [router]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName });
      toast.success(t("settings.savedProfile"));
    } catch (e) {
      console.error(e);
      toast.error(t("settings.errorProfile"));
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

  const handleChangeLocale = (loc: Locale) => {
    setLocaleState(loc);
    changeLocale(loc);
  };

  const handleClearLocal = () => {
    localStorage.clear();
    toast.success(t("settings.localCleared"));
  };

  const handleExportData = () => {
    const data = {
      user: user?.email,
      prefs: { theme, locale },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klip-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("settings.dataExported"));
  };

  return (
    <div className="space-y-8 px-4 sm:px-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* Perfil */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.profile")}</h2>
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

      {/* Preferencias */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.preferences")}</h2>
        <div className="space-y-3">
          <Label>{t("theme")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 sm:flex-none"
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              🌞 {t("light")}
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              🌙 {t("dark")}
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              variant={theme === "system" ? "default" : "outline"}
              onClick={() => setTheme("system")}
            >
              🖥 {t("system")}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>{t("language")}</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LOCALES).map(([code, label]) => (
              <Button
                key={code}
                className="flex-1 sm:flex-none"
                variant={locale === code ? "default" : "outline"}
                onClick={() => handleChangeLocale(code as Locale)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Notificaciones */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.notifications")}</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>{t("settings.emailNotifications")}</Label>
            <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("settings.pushNotifications")}</Label>
            <Switch checked={notifPush} onCheckedChange={setNotifPush} />
          </div>
          <div className="flex items-center justify-between">
            <Label>WhatsApp</Label>
            <Switch checked={notifWhatsApp} onCheckedChange={setNotifWhatsApp} />
          </div>
        </div>
      </Card>

      {/* Privacidad */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">🔒 {t("settings.privacy")}</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>{t("settings.shareData")}</Label>
            <Switch checked={shareData} onCheckedChange={setShareData} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("settings.profileVisibility")}</Label>
            <Switch
              checked={profileVisibility}
              onCheckedChange={setProfileVisibility}
            />
          </div>
        </div>
      </Card>

      {/* Seguridad */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">🛡 {t("settings.security")}</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>{t("settings.twoFactor")}</Label>
            <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
          </div>
          <Button
            variant="outline"
            onClick={() => toast.info(t("settings.activeSessions"))}
            className="w-full sm:w-auto"
          >
            {t("settings.viewSessions")}
          </Button>
        </div>
      </Card>

      {/* Integraciones */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">🔌 {t("settings.integrations")}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => toast.info("Conectar Instagram...")}
            className="w-full sm:w-auto"
          >
            📷 {t("settings.connectInstagram")}
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info("Conectar Metricool...")}
            className="w-full sm:w-auto"
          >
            📊 {t("settings.connectMetricool")}
          </Button>
        </div>
      </Card>

      {/* Avanzado */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">⚙️ {t("settings.advanced")}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClearLocal}
            className="w-full sm:w-auto"
          >
            🗑 {t("settings.clearLocal")}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportData}
            className="w-full sm:w-auto"
          >
            📂 {t("settings.exportData")}
          </Button>
        </div>
        <Button
          variant="destructive"
          onClick={handleDeleteAccount}
          className="mt-4 w-full sm:w-auto"
        >
          ❌ {t("settings.deleteAccount")}
        </Button>
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
          className="w-full sm:w-auto"
        >
          {t("settings.manageSubscription")}
        </Button>
      </Card>
    </div>
  );
}
