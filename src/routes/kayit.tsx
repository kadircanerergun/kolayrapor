import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  User,
  Hash,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmbeddedRegistrationForm } from "@/components/embedded-registration-form";
import { useSubscription } from "@/hooks/useSubscription";

function RegistrationPage() {
  const { pharmacy, isPending, loading, refresh } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Active pharmacy
  if (pharmacy && !isPending) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Eczane Kaydı</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Eczaneniz zaten kayıtlı
              </CardTitle>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Aktif
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-lg font-semibold">{pharmacy.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                {pharmacy.nameSurname}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {pharmacy.pharmacyPhone}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" />
                GLN: {pharmacy.glnNumber}
              </p>
              {pharmacy.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {pharmacy.address}
                </p>
              )}
              {pharmacy.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {pharmacy.phone}
                </p>
              )}
              {pharmacy.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {pharmacy.email}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Link to="/ayarlar">
              <Button variant="outline">Ayarlara Git</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Pending pharmacy
  if (pharmacy && isPending) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Eczane Kaydı</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                {pharmacy.name}
              </CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Onay Bekleniyor
              </Badge>
            </div>
            <CardDescription>
              Eczane kaydınız yönetici tarafından inceleniyor. Onaylandıktan
              sonra tüm özellikleri kullanabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Kaydınız onay bekliyor</p>
                <p className="text-sm text-muted-foreground">
                  Yönetici kaydınızı en kısa sürede inceleyecektir. Onay
                  sonrası bu sayfa otomatik olarak güncellenecektir.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={refresh}>
              Durumu Yenile
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // No pharmacy — embed the landing page registration form
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Eczane Kaydı</h1>
        </div>
        <p className="text-muted-foreground">
          Uygulamayı kullanmak için eczanenizi kaydedin
        </p>
      </div>

      <EmbeddedRegistrationForm onRegistered={refresh} />
    </div>
  );
}

export const Route = createFileRoute("/kayit")({
  component: RegistrationPage,
});
