'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import UserDropdown from '@/components/layout/UserDropdown';
import { useT } from '@/lib/i18n';
import clsx from 'clsx';

interface UserInfo {
  email: string;
  photoURL?: string;
  plan?: string;
}

export function Sidebar() {
  const t = useT();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/stripe/subscription', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setUserInfo({
            email: user.email ?? '—',
            photoURL: user.photoURL ?? '',
            plan: data?.plan || t('sidebar.noPlan'),
          });
        } catch {
          setUserInfo({
            email: user.email ?? '—',
            photoURL: user.photoURL ?? '',
            plan: t('sidebar.noPlan'),
          });
        }
      } else {
        setUserInfo(null);
      }
    });
    return () => unsubscribe();
  }, [t]);

  const links = [
    { href: '/dashboard', key: 'sidebar.home' },
    { href: '/dashboard/scripts', key: 'sidebar.scripts' },
    { href: '/dashboard/videos', key: 'sidebar.videos' },

    // Rutas adicionales traídas de main (manteniendo i18n)
    { href: '/dashboard/calendario-publicacion', key: 'sidebar.calendar' },
    { href: '/dashboard/ia-marca', key: 'sidebar.brandAI' },
    { href: '/dashboard/ideas-virales', key: 'sidebar.viralIdeas' },
    { href: '/dashboard/solicitar-reel', key: 'sidebar.requestReel' },
    { href: '/dashboard/archivos-recursos', key: 'sidebar.assets' },
    { href: '/dashboard/estadisticas', key: 'sidebar.stats' },

    { href: '/dashboard/mynotifications', key: 'sidebar.notifications' },
    { href: '/dashboard/facturacion', key: 'sidebar.billing' },
    { href: '/dashboard/soporte', key: 'sidebar.support' },
    { href: '/dashboard/user', key: 'sidebar.account' },
  ];

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-bold mb-6">{t('sidebar.clientTitle')}</h2>
        <nav className="flex flex-col gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'px-3 py-2 rounded-md transition',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
      </div>

      {userInfo ? (
        <UserDropdown user={userInfo} />
      ) : (
        <p className="text-muted-foreground">{t('sidebar.notAuthenticated')}</p>
      )}
    </aside>
  );
}
