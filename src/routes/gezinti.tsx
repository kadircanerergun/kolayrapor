import { createFileRoute } from "@tanstack/react-router";

// BrowserView is rendered persistently in MainLayout to preserve state across tab switches.
// This route component is intentionally empty.
function Gezinti() {
  return null;
}

export const Route = createFileRoute("/gezinti")({
  component: Gezinti,
});
