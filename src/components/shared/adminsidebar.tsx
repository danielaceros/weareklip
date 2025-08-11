// src/components/shared/adminsidebar.tsx
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
  uid?: string;
}

const rawLinks = [
  { href: '/admin', key: 'sidebar.adminHome' },
  { href: '/admin/clients', key: 'sidebar.clients' },
  { href: '/admin/tasks', key: 'sidebar.tasks' },
  { href: '/admin/notifications', key: 'sidebar.adminNotifications' },
];

export function AdminSidebar() {
  const t = useT();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setUserInfo(null);
        return;
      }
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
          uid: user.uid,
        });
      } catch {
        // ✅ nada de `any`; user.uid es válido aquí
        setUserInfo({
          email: user.email ?? '—',
          photoURL: user.photoURL ?? '',
          plan: t('sidebar.noPlan'),
          uid: user.uid,
        });
      }
    });
    return () => unsubscribe();
  }, [t]);

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-bold mb-6">{t('sidebar.adminTitle')}</h2>
        <nav className="flex flex-col gap-2">
          {rawLinks.map((link) => {
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
