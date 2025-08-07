'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import UserDropdown from '@/components/layout/UserDropdown';

interface UserInfo {
  email: string;
  photoURL?: string;
  plan?: string;
}

export function Sidebar() {
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
            email: user.email ?? 'Sin email',
            photoURL: user.photoURL ?? '',
            plan: data?.plan || 'Sin plan',
          });
        } catch {
          setUserInfo({
            email: user.email ?? 'Sin email',
            photoURL: user.photoURL ?? '',
            plan: 'Sin plan',
          });
        }
      } else {
        setUserInfo(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const links = [
    { href: '/dashboard', label: 'Inicio' },
    { href: '/dashboard/scripts', label: 'Mis Guiones' },
    { href: '/dashboard/videos', label: 'Mis Vídeos' },
    { href: '/dashboard/mynotifications', label: 'Mis Notificaciones' },
    { href: '/dashboard/user', label: 'Mi Cuenta' },
  ];

  return (
    <aside className="w-64 bg-white border-r p-4 flex flex-col justify-between">
      {/* Menú principal arriba */}
      <div>
        <h2 className="text-lg font-bold mb-6">Panel Cliente</h2>
        <nav className="flex flex-col gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-md hover:bg-muted transition ${
                pathname === link.href ? 'bg-muted font-semibold' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Perfil y menú contextual */}
      {userInfo ? (
        <UserDropdown user={userInfo} />
      ) : (
        <p className="text-gray-600">No autenticado</p>
      )}
    </aside>
  );
}