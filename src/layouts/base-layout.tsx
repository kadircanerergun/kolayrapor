import React from "react";
import DragWindowRegion from "@/components/drag-window-region";
import { DialogContextProvider } from "@/contexts/dialog-context";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="Kolay Rapor" />
      <DialogContextProvider>
        <main className="h-screen">{children}</main>
      </DialogContextProvider>
    </>
  );
}
