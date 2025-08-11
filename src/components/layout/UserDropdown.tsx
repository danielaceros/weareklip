'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useTheme } from 'next-themes';
import { auth } from '@/lib/firebase';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

import { ACCENTS, type AccentId, setAccent, initAccent } from '@/lib/theme';
import {
  LOCALES,
  type Locale,
  useT,
  changeLocale,
  getStoredLocale,
} from '@/lib/i18n';

interface Props {
  user: {
    email: string;
    photoURL?: string;
    plan?: string;
  };
}

export default function UserDropdown({ user }: Props) {
  const t = useT();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [accent, setAccentState] = useState<AccentId>('blue');
  const [locale, setLocaleState] = useState<Locale>('es');

  useEffect(() => {
    setAccentState(initAccent());
    setLocaleState(getStoredLocale());
  }, []);

  const handleChangeAccent = (value: string) => {
    const id = value as AccentId;
    setAccentState(id);
    setAccent(id);
  };

  const handleChangeLocale = async (value: string) => {
    const loc = value as Locale;
    setLocaleState(loc);

    // Intenta persistir en Firestore (users/{uid}/settings.lang) si está logueado
    try {
      const u = auth.currentUser;
      if (u) {
        const token = await u.getIdToken();
        // No bloquea el cambio: se hace en background
        fetch('/api/users/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ lang: loc }),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // silencioso
    }

    // Cookie + localStorage + recarga para que NextIntl cargue el paquete correcto
    changeLocale(loc);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (err) {
      console.error('signOut error', err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('account')}
          className="
            flex items-center gap-3 p-2 rounded transition-colors
            bg-transparent text-sidebar-foreground
            hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt="Foto de perfil"
              width={32}
              height={32}
              className="rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
              {user.email.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <p className="truncate font-semibold">{user.email}</p>
            <p className="text-xs text-muted-foreground truncate">
              {t('sidebar.planLabel')}: {user.plan ?? t('sidebar.noPlan')}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 bg-popover text-popover-foreground border border-border"
      >
        <DropdownMenuLabel>{t('account')}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Tema */}
        <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? 'system'}
          onValueChange={(value) => setTheme(value)}
        >
          <DropdownMenuRadioItem value="light">🌞 {t('light')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">🌙 {t('dark')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">🖥 {t('system')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Color */}
        <DropdownMenuLabel>{t('color')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={accent} onValueChange={handleChangeAccent}>
          {ACCENTS.map((a) => (
            <DropdownMenuRadioItem key={a.id} value={a.id}>
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: a.palette[500] }}
              />
              {t(`accents.${a.id}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Idioma */}
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleChangeLocale}>
          {Object.entries(LOCALES).map(([code, label]) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
          ⚙️ {t('settings')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
          🚪 {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
