import React from "react";
import DragWindowRegion from "@/components/drag-window-region";
import { DialogContextProvider } from "@/contexts/dialog-context";
import { CredentialsProvider } from "@/contexts/credentials-context";
import { PharmacyProvider } from "@/contexts/pharmacy-context";
import {
  MaintenanceProvider,
  useMaintenance,
} from "@/contexts/maintenance-context";
import { FeatureFlagsProvider } from "@/contexts/feature-flags-context";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { AgreementModal } from "@/components/agreement-modal";

/**
 * When maintenance mode is active, short-circuit the whole app (including the
 * data-loading providers) and show the maintenance screen instead.
 */
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { active } = useMaintenance();
  if (active) return <MaintenanceScreen />;
  return <>{children}</>;
}

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="KolayRapor" />
      <MaintenanceProvider>
        <MaintenanceGate>
          <CredentialsProvider>
            <PharmacyProvider>
              <FeatureFlagsProvider>
                <DialogContextProvider>
                  <AgreementModal />
                  <main className="h-screen">{children}</main>
                </DialogContextProvider>
              </FeatureFlagsProvider>
            </PharmacyProvider>
          </CredentialsProvider>
        </MaintenanceGate>
      </MaintenanceProvider>
    </>
  );
}
