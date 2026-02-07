import { createFileRoute } from "@tanstack/react-router";
import { BrowserView } from "@/components/browser-view";

function Gezinti() {
  return (
    <div className="flex h-full flex-col">
      <BrowserView />
    </div>
  );
}

export const Route = createFileRoute("/gezinti")({
  component: Gezinti,
});
