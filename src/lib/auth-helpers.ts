import { adminAuth } from "@/lib/firebase-admin";

/** Lee Authorization: Bearer <idToken Firebase> y devuelve uid. */
export async function requireUserUid(req: Request): Promise<string> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("No auth");
  const idToken = m[1];

  const decoded = await adminAuth.verifyIdToken(idToken);
  if (!decoded?.uid) throw new Error("No uid");
  return decoded.uid;
}
