import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect } from "react";
import { SubscriptionProducts } from "@/components/subscription-products";
import { CreditPackages } from "@/components/credit-packages";
import { CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface SubscriptionSearch {
  section?: "credits";
}

function SubscriptionPage() {
  const { section } = Route.useSearch();
  const creditsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (section === "credits" && creditsRef.current) {
      creditsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [section]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">
            {section === "credits" ? "Ek Kredi Satın Al" : "Lisans Planları"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {section === "credits"
            ? "Ek kredi satın alarak hizmetlerimizi kullanmaya devam edin"
            : "İhtiyacınıza uygun planı seçin ve hemen kullanmaya başlayın"}
        </p>
      </div>

      {/* Subscription Products — hide if coming for credits only */}
      {section !== "credits" && (
        <>
          <SubscriptionProducts />
          <Separator />
        </>
      )}

      {/* Credit Packages */}
      <div ref={creditsRef}>
        <CreditPackages />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/subscription")({
  validateSearch: (search: Record<string, unknown>): SubscriptionSearch => ({
    section: search.section === "credits" ? "credits" : undefined,
  }),
  component: SubscriptionPage,
});
