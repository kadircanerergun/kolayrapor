import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePharmacy } from "@/contexts/pharmacy-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, CreditCard, Settings } from "lucide-react";

interface PharmacyRequiredProps {
  children: ReactNode;
}

export function PharmacyRequired({ children }: PharmacyRequiredProps) {
  const { pharmacy, subscription, loading } = usePharmacy();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!pharmacy) {
    return (
      <div className="flex items-center justify-center p-12">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Eczane Bulunamadı</h2>
              <p className="text-sm text-muted-foreground">
                Bu özelliği kullanabilmek için eczanenizin sisteme kayıtlı
                olması gerekmektedir. IP adresinize bağlı bir eczane kaydı
                bulunamadı.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Link to="/ayarlar">
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Ayarlar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subscription || subscription.status !== "active") {
    return (
      <div className="flex items-center justify-center p-12">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Abonelik Gerekli</h2>
              <p className="text-sm text-muted-foreground">
                Bu özelliği kullanabilmek için aktif bir aboneliğe sahip
                olmanız gerekmektedir.
              </p>
            </div>
            <Link to="/subscription">
              <Button>
                <CreditCard className="h-4 w-4 mr-2" />
                Abonelik Planlarını Görüntüle
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
