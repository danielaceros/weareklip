import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDB } from '@/lib/firebase-admin';
import type { Locale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = auth.slice('Bearer '.length);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Validación del cuerpo (body) y del idioma
    const body = await req.json().catch(() => ({}));
    const lang = body?.lang as Locale | undefined;

    const allowed: Locale[] = ['es', 'en', 'fr'];
    if (!lang || !allowed.includes(lang)) {
      return NextResponse.json({ error: 'Invalid "lang"' }, { status: 400 });
    }

    // Actualizar la configuración del idioma
    await adminDB
      .collection('users')
      .doc(uid)
      .set(
        {
          settings: {
            lang,
            updatedAt: Date.now(),
          },
        },
        { merge: true } // Merge evita sobrescribir otros campos
      );

    // Respuesta exitosa
    return NextResponse.json({ ok: true, lang });
  } catch (err) {
    console.error('POST /api/users/settings error', err);

    // Errores más detallados
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
