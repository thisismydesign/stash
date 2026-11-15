import { useEffect } from "react";

const SITE = "Stash";

/** Names the browser tab after what is open, and after the site alone once it closes. */
export function usePageTitle(name?: string) {
  useEffect(() => {
    document.title = name ? `${name} | ${SITE}` : SITE;
    return () => {
      document.title = SITE;
    };
  }, [name]);
}
