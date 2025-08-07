'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
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
import { ACCENTS, AccentId, setAccent, initAccent } from '@/lib/theme';
import {
  LOCALES,
  Locale,
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
  const { theme, setTheme } = useTheme();
  const [accent, setAccentState] = useState<AccentId>('blue');
  const [locale, setLocaleState] = useState<Locale>('es');

  useEffect(() => {
    setAccentState(initAccent());
    setLocaleState(getStoredLocale());
  }, []);

  const t = useT();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 p-2 rounded hover:bg-gray-100">
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
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
              {user.email.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <p className="truncate font-semibold">{user.email}</p>
            <p className="text-xs text-gray-500 truncate">Plan: {user.plan}</p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('account')}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Tema */}
        <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value: string) => setTheme(value)}
        >
          <DropdownMenuRadioItem value="light">
            🌞 {t('light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            🌙 {t('dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            🖥 {t('system')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Color */}
        <DropdownMenuLabel>{t('color')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={accent}
          onValueChange={(value: string) => {
            const id = value as AccentId;
            setAccentState(id);
            setAccent(id);
          }}
        >
          {ACCENTS.map((a) => (
            <DropdownMenuRadioItem key={a.id} value={a.id}>
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: a.palette[500] }}
              />
              {a.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Idioma */}
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value: string) => {
            const loc = value as Locale;
            setLocaleState(loc);
            changeLocale(loc);
          }}
        >
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

        <DropdownMenuItem
          className="text-red-600"
          onClick={() => {
            signOut(auth);
            router.push('/login');
          }}
        >
          🚪 {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}