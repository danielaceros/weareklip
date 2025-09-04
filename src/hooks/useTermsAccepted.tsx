"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";

type TermsResult = {
  loading: boolean;
  accepted: boolean | null;
};

export default function useTermsAccepted(): TermsResult {
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;
      if (!user) {
        setAccepted(null);
        setLoading(false);
        return;
      }

      try {
        const token = await getIdToken(user, true);
        const res = await fetch(`/api/firebase/users/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        console.log(data)
        if (res.ok && data) {
          // 👇 si el campo no existe lo tratamos como "false"
          setAccepted(Boolean(data.isTermsAccepted));
        } else {
          setAccepted(false);
        }
      } catch (e) {
        console.error("useTermsAccepted error:", e);
        setAccepted(false);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return { loading, accepted };
}
