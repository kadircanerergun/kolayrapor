import { createFileRoute } from "@tanstack/react-router";
import { BrowserView } from "@/components/browser-view";
import { PharmacyRequired } from "@/components/pharmacy-required";

function Gezinti() {
  return (
    <PharmacyRequired>
      <div className="flex h-full flex-col">
        <BrowserView />
      </div>
    </PharmacyRequired>
  );
}

export const Route = createFileRoute("/gezinti")({
  component: Gezinti,
});
