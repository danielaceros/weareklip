"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useT } from "@/lib/i18n";
import clsx from "clsx";
import {
  Home,
  Sparkles,
  FileText,
  Music,
  Video,
  FileCode2,
  Camera,
} from "lucide-react";

interface UserInfo {
  email: string;
  photoURL?: string;
  plan?: string;
  status?: string;
  trialEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}

export function Sidebar() {
  const t = useT();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserInfo({
          email: user.email ?? "—",
          photoURL: user.photoURL ?? "",
          plan: t("sidebar.noPlan"),
        });
      } else {
        setUserInfo(null);
      }
    });
    return () => unsubscribe();
  }, [t]);

  const links = [
    { href: "/dashboard", key: "home", label: "sidebar.home", icon: Home },
    { href: "/dashboard/ideas", key: "viralIdeas", label: "sidebar.viralIdeas", icon: Sparkles },
    { href: "/dashboard/script", key: "scripts", label: "sidebar.scripts", icon: FileText },
    { href: "/dashboard/audio", key: "audio", label: "sidebar.audio", icon: Music },
    { href: "/dashboard/video", key: "lipsync", label: "sidebar.lipsync", icon: Camera },
    { href: "/dashboard/edit", key: "video", label: "sidebar.video", icon: Video },
    { href: "/dashboard/clones", key: "clones", label: "sidebar.clones", icon: FileCode2 },
  ];

  // 👉 Reordenamos para mobile pero mantenemos los mismos ids (`mobile-${key}`)
  const mobileOrder = ["viralIdeas", "scripts", "audio", "home", "lipsync", "video", "clones"];
  const mobileLinks = mobileOrder.map((key) => links.find((l) => l.key === key)!);

  return (
    <>
      {/* 📌 Sidebar (solo desktop) */}
      <aside
        role="navigation"
        aria-label={t("sidebar.clientTitle")}
        className="hidden md:flex h-screen w-20 flex-col items-center border-r bg-sidebar border-sidebar-border text-sidebar-foreground py-6"
      >
        <nav className="flex flex-col items-center gap-6">
          {links.map(({ href, key, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                id={`sidebar-${key}`}
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 text-xs"
              >
                <div
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    active
                      ? "bg-muted text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-primary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={clsx(
                    "leading-none transition-colors",
                    active
                      ? "font-medium text-sidebar-primary"
                      : "text-sidebar-foreground"
                  )}
                >
                  {t(label)}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 📌 Bottom Navigation (solo mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-neutral-800 bg-black py-2">
        {mobileLinks.map(({ href, key, label, icon: Icon }) => {
          const isHome = href === "/dashboard";
          const active = isHome
            ? pathname === "/dashboard" || pathname === "/dashboard/"
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              id={`mobile-${key}`}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center text-xs"
            >
              <Icon
                className={clsx(
                  "h-6 w-6",
                  active ? "text-white" : "text-neutral-400"
                )}
              />
              <span
                className={clsx(
                  "mt-1",
                  active ? "text-white font-medium" : "text-neutral-400"
                )}
              >
                {t(label)}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

