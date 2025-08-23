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

import {
  LogOut,
  Settings,
  Palette,
  Languages,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

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
    try {
      const u = auth.currentUser;
      if (u) {
        const token = await u.getIdToken();
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
    } catch {}
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
          aria-label={t('dropdown.account')}
          className="
            flex items-center gap-3 w-full p-2 rounded-md transition
            bg-transparent text-sm
            hover:bg-accent hover:text-accent-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt="Foto de perfil"
              width={36}
              height={36}
              className="rounded-full border border-border object-cover"
              unoptimized
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold border border-border">
              {user.email.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col text-left min-w-0">
            <p className="truncate font-medium text-sm">{user.email}</p>
            <span className="text-xs text-muted-foreground truncate">
              {t('sidebar.planLabel')}:{' '}
              <span className="font-medium text-foreground">
                {user.plan ?? t('sidebar.noPlan')}
              </span>
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-60 bg-popover text-popover-foreground border border-border shadow-lg rounded-md"
      >
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('dropdown.account')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Tema */}
        <DropdownMenuLabel className="flex items-center gap-2 text-sm font-medium">
          <Sun className="h-4 w-4" /> {t('dropdown.theme')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? 'system'}
          onValueChange={(value) => setTheme(value)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" /> {t('dropdown.light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" /> {t('dropdown.dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-4 w-4" /> {t('dropdown.system')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Color */}
        <DropdownMenuLabel className="flex items-center gap-2 text-sm font-medium">
          <Palette className="h-4 w-4" /> {t('dropdown.color')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={accent} onValueChange={handleChangeAccent}>
          {ACCENTS.map((a) => (
            <DropdownMenuRadioItem key={a.id} value={a.id}>
              <span
                className="inline-block w-3 h-3 rounded-full mr-2 border"
                style={{ backgroundColor: a.palette[500] }}
              />
              {t(`accents.${a.id}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Idioma */}
        <DropdownMenuLabel className="flex items-center gap-2 text-sm font-medium">
          <Languages className="h-4 w-4" /> {t('dropdown.language')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleChangeLocale}>
          {Object.entries(LOCALES).map(([code, label]) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Ajustes */}
        <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
          <Settings className="mr-2 h-4 w-4" /> {t('dropdown.settings')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> {t('dropdown.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
