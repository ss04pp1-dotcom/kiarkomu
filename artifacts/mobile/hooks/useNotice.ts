import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "../lib/firebase";

export interface Notice {
  message: string;
  updatedAt?: string;
}

export function useNotice(): Notice | null {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!firestoreDb) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = onSnapshot(
        doc(firestoreDb, "notices", "main"),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setNotice({ message: data.message ?? "", updatedAt: data.updatedAt ?? "" });
          } else {
            setNotice(null);
          }
        },
        () => setNotice(null)
      );
    } catch {
      setNotice(null);
    }
    return () => unsub?.();
  }, []);

  return notice;
}
