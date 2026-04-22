import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { LANDING_BASE_URL } from "@/lib/constants";

interface EmbeddedRegistrationFormProps {
  onRegistered: () => void;
  /** Optional height override; defaults to a tall value so the iframe rarely scrolls internally */
  height?: number;
}

export function EmbeddedRegistrationForm({
  onRegistered,
  height = 1100,
}: EmbeddedRegistrationFormProps) {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onRegisteredRef = useRef(onRegistered);

  useEffect(() => {
    onRegisteredRef.current = onRegistered;
  }, [onRegistered]);

  const src = useMemo(() => {
    const url = new URL("/kayit", LANDING_BASE_URL);
    url.searchParams.set("embed", "1");
    return url.toString();
  }, []);

  const expectedOrigin = useMemo(() => new URL(LANDING_BASE_URL).origin, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== expectedOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string } | null;
      if (data && data.type === "kolayrapor:registered") {
        onRegisteredRef.current();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [expectedOrigin]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border bg-background">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        title="Eczane Kayıt Formu"
        onLoad={() => setLoaded(true)}
        className="block w-full border-0"
        style={{ height }}
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
