import { createFileRoute } from "@tanstack/react-router";
import { BrowserView } from "@/components/browser-view";

function Gezinti() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Medulada Kontrol</h1>
        <p className="text-muted-foreground">
          SGK Medula portalında doğrudan gezinin
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BrowserView />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/gezinti")({
  component: Gezinti,
});
