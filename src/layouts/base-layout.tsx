import React from "react";
import DragWindowRegion from "@/components/drag-window-region";
import { DialogContextProvider } from "@/contexts/dialog-context";
import { CredentialsProvider } from "@/contexts/credentials-context";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="Kolay Rapor" />
      <CredentialsProvider>
        <DialogContextProvider>
          <main className="h-screen">{children}</main>
        </DialogContextProvider>
      </CredentialsProvider>
    </>
  );
}
