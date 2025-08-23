'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import UserDropdown from '@/components/layout/UserDropdown';
import { useT } from '@/lib/i18n';
import clsx from 'clsx';
import {
  Home,
  Sparkles,
  FileText,
  Music,
  Video,
  Scissors,
  Palette,
  Bell,
  LifeBuoy,
  User,
} from 'lucide-react';

interface UserInfo {
  email: string;
  photoURL?: string;
  plan?: string;
  status?: string;
  trialEnd?: number | null; // epoch seconds desde Stripe
  cancelAtPeriodEnd?: boolean; // 👈 nuevo
}

export function Sidebar() {
  const t = useT();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setLoadingStripe(true);
        try {
          let plan = t('sidebar.noPlan');
          let status: string | undefined;
          let trialEnd: number | null = null;
          let cancelAtPeriodEnd: boolean | undefined = undefined;

          if (user.email) {
            const res = await fetch(
              `/api/stripe/email?email=${encodeURIComponent(user.email)}`
            );
            const data = await res.json();

            if (res.ok) {
              plan = data.plan ?? plan;
              status = data.status;
              trialEnd = data.trial_end ?? null;
              cancelAtPeriodEnd = data.cancel_at_period_end ?? false; // 👈
            } else {
              console.warn('Stripe subscription fetch error:', data.error);
            }
          }

          setUserInfo({
            email: user.email ?? '—',
            photoURL: user.photoURL ?? '',
            plan,
            status,
            trialEnd,
            cancelAtPeriodEnd,
          });
        } catch (err) {
          console.error('Error fetching Stripe subscription:', err);
          setUserInfo({
            email: user.email ?? '—',
            photoURL: user.photoURL ?? '',
            plan: t('sidebar.noPlan'),
          });
        } finally {
          setLoadingStripe(false);
        }
      } else {
        setUserInfo(null);
      }
    });
    return () => unsubscribe();
  }, [t]);

  // Calcula días de prueba restantes
  const trialDaysLeft = useMemo(() => {
    if (!userInfo?.trialEnd) return null;
    const end = new Date(userInfo.trialEnd * 1000);
    const diff = Math.ceil(
      (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  }, [userInfo?.trialEnd]);

  const linksMain = [
    { href: '/dashboard', key: 'sidebar.home', icon: Home },
    { href: '/dashboard/ideas', key: 'sidebar.viralIdeas', icon: Sparkles },
    { href: '/dashboard/script', key: 'sidebar.scripts', icon: FileText },
    { href: '/dashboard/audio', key: 'sidebar.audio', icon: Music },
    { href: '/dashboard/video', key: 'sidebar.video', icon: Video },
    { href: '/dashboard/edit', key: 'sidebar.videos', icon: Scissors },
    { href: '/dashboard/ia-marca', key: 'sidebar.brandAI', icon: Palette },
    { href: '/dashboard/mynotifications', key: 'sidebar.notifications', icon: Bell },
  ];

  const linksSecondary = [
    { href: '/dashboard/soporte', key: 'sidebar.support', icon: LifeBuoy },
    { href: '/dashboard/user', key: 'sidebar.account', icon: User },
  ];

  return (
    <aside
      className="w-64 bg-card text-card-foreground border-r border-border flex flex-col"
      role="navigation"
      aria-label={t('sidebar.clientTitle')}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold">{t('sidebar.clientTitle')}</h2>
      </div>

      {/* Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Main */}
        <div className="space-y-1">
          {linksMain.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition',
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(link.key)}
              </Link>
            );
          })}
        </div>

        {/* Secondary */}
        <div className="space-y-1 border-t border-border pt-4">
          {linksSecondary.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition',
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(link.key)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer / User */}
      <div className="border-t border-border p-4 space-y-2">
        {loadingStripe && (
          <p className="text-xs text-muted-foreground">Consultando suscripción…</p>
        )}
        {userInfo && (
          <div className="flex flex-wrap gap-2">
            {/* Badge Plan */}
            {userInfo.plan && (
              <span className="px-2 py-1 text-xs rounded-full bg-accent text-accent-foreground">
                {userInfo.plan}
              </span>
            )}
            {/* Badge Trial */}
            {userInfo.status === 'trialing' && trialDaysLeft !== null && (
              <span className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-white">
                {trialDaysLeft} días de prueba
              </span>
            )}
            {/* Badge Cancelado */}
            {userInfo.cancelAtPeriodEnd && (
              <span className="px-2 py-1 text-xs rounded-full bg-red-500 text-white">
                Cancelada (fin de periodo)
              </span>
            )}
          </div>
        )}
        {userInfo ? (
          <UserDropdown user={userInfo} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('sidebar.notAuthenticated')}
          </p>
        )}
      </div>
    </aside>
  );
}
