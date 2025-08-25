// src/components/layout/UserDropdown.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useTheme } from "next-themes";
import { auth } from "@/lib/firebase";
import { useT, LOCALES, type Locale, changeLocale, getStoredLocale } from "@/lib/i18n";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

import {
  LogOut,
  Settings,
  Sun,
  Moon,
  Monitor,
  Languages,
  User as UserIcon,
  CreditCard,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

interface Props {
  user: {
    email: string;
    photoURL?: string;
    plan?: string;
    status?: string;
    trialEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
  };
}

export default function UserDropdown({ user }: Props) {
  const t = useT();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  const handleChangeLocale = async (value: string) => {
    const loc = value as Locale;
    setLocaleState(loc);
    try {
      const u = auth.currentUser;
      if (u) {
        const token = await u.getIdToken();
        fetch("/api/users/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ lang: loc }),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
    changeLocale(loc);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("signOut error", err);
    }
  };

  // calcular días restantes de trial
  const trialDaysLeft = (() => {
    if (!user?.trialEnd) return null;
    const end = new Date(user.trialEnd * 1000);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  })();

  return (
    <DropdownMenu>
      {/* Trigger: avatar redondo */}
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("dropdown.account")}
          className="h-9 w-9 rounded-full overflow-hidden ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt="Avatar"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-neutral-700 text-white grid place-items-center">
              <span className="text-sm font-medium">
                {user.email?.[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      {/* Menú */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-2xl border border-border bg-popover p-2 shadow-lg"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-base font-semibold">
          {t("dropdown.account") /* "Mi cuenta" */}
        </DropdownMenuLabel>

        {/* Badges debajo de "Mi cuenta" */}
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          {user.plan && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground">
              {user.plan}
            </span>
          )}
          {user.status === "trialing" && trialDaysLeft !== null && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500 text-white">
              {trialDaysLeft} días de prueba
            </span>
          )}
          {user.cancelAtPeriodEnd && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
              Cancelada (fin periodo)
            </span>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Submenú: Tema */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="justify-between">
            <span className="flex items-center gap-2">
              <Sun className="h-4 w-4 opacity-80" />
              {t("dropdown.theme")}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4" /> {t("dropdown.light")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4" /> {t("dropdown.dark")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4" /> {t("dropdown.system")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Submenú: Idioma */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="justify-between">
            <span className="flex items-center gap-2">
              <Languages className="h-4 w-4 opacity-80" />
              {t("dropdown.language")}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuRadioGroup value={locale} onValueChange={handleChangeLocale}>
              {Object.entries(LOCALES).map(([code, label]) => (
                <DropdownMenuRadioItem key={code} value={code}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Items simples */}
        <DropdownMenuItem
          onClick={() => router.push("/dashboard/user")}
          className="cursor-pointer"
        >
          <UserIcon className="mr-2 h-4 w-4 opacity-80" />
          {t("dropdown.profile") ?? "Mi perfil"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/dashboard/billing")}
          className="cursor-pointer"
        >
          <CreditCard className="mr-2 h-4 w-4 opacity-80" />
          {t("dropdown.subscription") ?? "Suscripción"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/dashboard/settings")}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4 opacity-80" />
          {t("dropdown.settings")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("dropdown.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
