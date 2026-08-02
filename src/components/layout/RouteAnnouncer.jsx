import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getPageMeta } from "@/lib/uiExperience";

export function RouteAnnouncer() {
  const location = useLocation();
  const announcementRef = useRef(null);

  useEffect(() => {
    const meta = getPageMeta(location.pathname);
    document.title = `${meta.title} · Typing Master`;
    if (announcementRef.current) {
      announcementRef.current.textContent = `${meta.title}. ${meta.description}`;
    }
  }, [location.pathname]);

  return (
    <p
      ref={announcementRef}
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
    />
  );
}
