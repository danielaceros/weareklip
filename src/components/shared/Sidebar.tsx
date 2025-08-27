'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import clsx from 'clsx';
import {
  Home,
  Sparkles,
  FileText,
  Music,
  Video,
  FileCode2,
  Camera,
} from 'lucide-react';

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
          email: user.email ?? '—',
          photoURL: user.photoURL ?? '',
          plan: t('sidebar.noPlan'),
        });
      } else {
        setUserInfo(null);
      }
    });
    return () => unsubscribe();
  }, [t]);

  const links = [
    { href: '/dashboard', key: 'sidebar.home', icon: Home },
    { href: '/dashboard/ideas', key: 'sidebar.viralIdeas', icon: Sparkles },
    { href: '/dashboard/script', key: 'sidebar.scripts', icon: FileText },
    { href: '/dashboard/audio', key: 'sidebar.audio', icon: Music },
    { href: '/dashboard/video', key: 'sidebar.lipsync', icon: Camera },
    { href: '/dashboard/edit', key: 'sidebar.video', icon: Video },
    { href: '/dashboard/clones', key: 'sidebar.clones', icon: FileCode2 },
  ];

  return (
    <aside
      role="navigation"
      aria-label={t('sidebar.clientTitle')}
      className="flex h-screen w-20 flex-col items-center border-r bg-sidebar border-sidebar-border text-sidebar-foreground py-6"
    >
      <nav className="flex flex-col items-center gap-6">
        {links.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
                key={href}
                href={href}
                id={`sidebar-${key.replace("sidebar.", "")}`} // 👈 IDs válidos
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 text-xs"
              >
              <div
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'bg-muted text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-muted hover:text-sidebar-primary'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={clsx(
                  'leading-none transition-colors',
                  active ? 'font-medium text-sidebar-primary' : 'text-sidebar-foreground'
                )}
              >
                {t(key)}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
