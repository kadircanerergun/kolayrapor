import React from "react";
import DragWindowRegion from "@/components/drag-window-region";
import { DialogContextProvider } from "@/contexts/dialog-context";
import { CredentialsProvider } from "@/contexts/credentials-context";
import { PharmacyProvider } from "@/contexts/pharmacy-context";
import { AgreementModal } from "@/components/agreement-modal";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="KolayRapor" />
      <CredentialsProvider>
        <PharmacyProvider>
          <DialogContextProvider>
            <AgreementModal />
            <main className="h-screen">{children}</main>
          </DialogContextProvider>
        </PharmacyProvider>
      </CredentialsProvider>
    </>
  );
}
