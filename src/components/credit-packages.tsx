import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function CreditPackages() {
  const { pharmacy, isPending, creditPackages, creditBalance } = useSubscription();
  const navigate = useNavigate();

  const handlePurchase = (pkgId: string) => {
    if (!pharmacy || isPending) {
      toast.info("Satın alabilmek için öncelikle kaydolmalısınız.");
      navigate({ to: "/kayit" });
      return;
    }
    navigate({
      to: "/odeme",
      search: { type: "credit", id: pkgId },
    });
  };

  if (creditPackages.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Kredi Paketleri
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ek kredi satın alarak hizmetlerimizi kullanmaya devam edin
          </p>
        </div>
        {creditBalance && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            Mevcut: {Number(creditBalance.balance).toFixed(0)} kredi
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {creditPackages.map((pkg) => (
          <Card key={pkg.id} className="flex flex-col">
            <CardContent className="flex-1 pt-6">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {pkg.description}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold">
                    {Number(pkg.creditAmount).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">kredi</p>
                </div>
                <p className="text-xl font-semibold text-primary">
                  ₺{Number(pkg.price).toFixed(2)}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handlePurchase(pkg.id)}
              >
                Satın Al
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
