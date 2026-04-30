import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

const POST_REGISTER_POLL_INTERVAL_MS = 1500;
const POST_REGISTER_POLL_MAX_ATTEMPTS = 6;

function RegistrationPage() {
  const { pharmacy, isPending, loading, refresh } = useSubscription();
  const navigate = useNavigate();
  const [justRegistered, setJustRegistered] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleRegistered = useCallback(() => {
    setJustRegistered(true);
    refresh();
  }, [refresh]);

  // Poll the API a few times after registration to catch auto-approval
  // (e.g. Kolay Asistan SSO) that completes shortly after the iframe message.
  useEffect(() => {
    if (!justRegistered) return;
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts++;
      refresh();
      if (attempts >= POST_REGISTER_POLL_MAX_ATTEMPTS) {
        stopPolling();
        setJustRegistered(false);
      }
    }, POST_REGISTER_POLL_INTERVAL_MS);
    return stopPolling;
  }, [justRegistered, refresh, stopPolling]);

  // When auto-approval is detected, drop into the app immediately.
  useEffect(() => {
    if (justRegistered && pharmacy && !isPending) {
      stopPolling();
      setJustRegistered(false);
      navigate({ to: "/home" });
    }
  }, [justRegistered, pharmacy, isPending, navigate, stopPolling]);

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

  // Just registered — wait briefly for backend auto-approval (Kolay Asistan SSO etc.)
  if (justRegistered) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Spinner size="lg" />
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">Hoş geldiniz!</h2>
          <p className="text-sm text-muted-foreground">
            Eczane bilgileriniz hazırlanıyor...
          </p>
        </div>
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
    <div className="p-6 space-y-6 bg-white">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Eczane Kaydı</h1>
        </div>
        <p className="text-muted-foreground">
          Uygulamayı kullanmak için eczanenizi kaydedin
        </p>
      </div>

      <EmbeddedRegistrationForm onRegistered={handleRegistered} />
    </div>
  );
}

export const Route = createFileRoute("/kayit")({
  component: RegistrationPage,
});
