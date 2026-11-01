import { useEffect } from "react";

/** Calls `reload` when the tab comes back to the front: someone else may have written meanwhile. */
export function useReloadOnReturn(reload: () => Promise<void>) {
  useEffect(() => {
    const onReturn = () => !document.hidden && void reload();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [reload]);
}
