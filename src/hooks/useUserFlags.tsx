"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";

type FlagsResult = {
  loading: boolean;
  isTermsAccepted: boolean;
  onboardingCompleted: boolean;
};

export default function useUserFlags(): FlagsResult {
  const [loading, setLoading] = useState(true);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setIsTermsAccepted(false);
        setOnboardingCompleted(false);
        setLoading(false);
        return;
      }

      try {
        const token = await getIdToken(user, true);
        const res = await fetch(`/api/firebase/users/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setIsTermsAccepted(Boolean(data.isTermsAccepted));
        setOnboardingCompleted(Boolean(data.onboardingCompleted));
      } catch (e) {
        console.error("useUserFlags error:", e);
        setIsTermsAccepted(false);
        setOnboardingCompleted(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { loading, isTermsAccepted, onboardingCompleted };
}
