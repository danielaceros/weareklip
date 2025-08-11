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

    const body = await req.json().catch(() => ({}));
    const lang = body?.lang as Locale | undefined;

    const allowed: Locale[] = ['es', 'en', 'fr'];
    if (!lang || !allowed.includes(lang)) {
      return NextResponse.json({ error: 'Invalid "lang"' }, { status: 400 });
    }

    // Guarda en users/{uid}/settings.lang (merge sin pisar otros campos)
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
        { merge: true }
      );

    return NextResponse.json({ ok: true, lang });
  } catch (err) {
    console.error('POST /api/users/settings error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
