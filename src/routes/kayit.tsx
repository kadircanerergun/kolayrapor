import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Globe,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useSubscription } from "@/hooks/useSubscription";
import { useDialog } from "@/hooks/useDialog";
import { subscriptionApiService } from "@/services/subscription-api";

function RegistrationPage() {
  const { pharmacy, isPending, ipAddress, loading, refresh } = useSubscription();
  const { showAlert } = useDialog();

  const [name, setName] = useState("");
  const [nameSurname, setNameSurname] = useState("");
  const [pharmacyPhone, setPharmacyPhone] = useState("");
  const [glnNumber, setGlnNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ip, setIp] = useState(ipAddress ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !nameSurname.trim() || !pharmacyPhone.trim() || !glnNumber.trim()) {
      showAlert({
        title: "Uyari",
        description: "Eczane adi, ad soyad, eczane telefonu ve GLN numarasi zorunludur.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await subscriptionApiService.registerPharmacy({
        name: name.trim(),
        nameSurname: nameSurname.trim(),
        pharmacyPhone: pharmacyPhone.trim(),
        glnNumber: glnNumber.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        ipAddress: ip.trim() || undefined,
      });
      showAlert({
        title: "Basarili",
        description: "Eczane kaydiniz alindi. Yonetici onayi bekleniyor.",
      });
      await refresh();
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Kayit islemi sirasinda bir hata olustu.";
      showAlert({
        title: "Hata",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

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
            <h1 className="text-3xl font-bold">Eczane Kaydi</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Eczaneniz zaten kayitli
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
            <h1 className="text-3xl font-bold">Eczane Kaydi</h1>
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
              Eczane kaydiniz yonetici tarafindan inceleniyor. Onaylandiktan
              sonra tum ozellikleri kullanabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Kaydiniz onay bekliyor
                </p>
                <p className="text-sm text-muted-foreground">
                  Yonetici kaydinizi en kisa surede inceleyecektir. Onay
                  sonrasi bu sayfa otomatik olarak guncellenecektir.
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

  // No pharmacy — registration form
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Eczane Kaydi</h1>
        </div>
        <p className="text-muted-foreground">
          Uygulamayi kullanmak icin eczanenizi kaydedin
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Eczane Kaydi</CardTitle>
          <CardDescription>
            Eczane bilgilerinizi girin. Kaydiniz yonetici onayi sonrasi
            aktif olacaktir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pharmacy-name">
              Eczane Adi <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pharmacy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ornek: Merkez Eczanesi"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pharmacy-name-surname">
              Ad Soyad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pharmacy-name-surname"
              value={nameSurname}
              onChange={(e) => setNameSurname(e.target.value)}
              placeholder="Eczaci ad soyad"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pharmacy-pharmacy-phone">
                Eczane Telefonu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pharmacy-pharmacy-phone"
                type="tel"
                value={pharmacyPhone}
                onChange={(e) => setPharmacyPhone(e.target.value)}
                placeholder="0 (2XX) XXX XX XX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy-gln-number">
                GLN Numarasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pharmacy-gln-number"
                value={glnNumber}
                onChange={(e) => setGlnNumber(e.target.value)}
                placeholder="GLN numarasi"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pharmacy-address">Adres</Label>
            <Input
              id="pharmacy-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Eczane adresi"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pharmacy-phone">Telefon (Kisisel)</Label>
              <Input
                id="pharmacy-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0 (5XX) XXX XX XX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy-email">E-posta</Label>
              <Input
                id="pharmacy-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eczane@ornek.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pharmacy-ip" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              IP Adresi
            </Label>
            <Input
              id="pharmacy-ip"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="Otomatik algilanir"
            />
            <p className="text-xs text-muted-foreground">
              Mevcut IP adresiniz otomatik olarak dolduruldu. Gerekirse
              degistirebilirsiniz.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleRegister}
            disabled={submitting || !name.trim() || !nameSurname.trim() || !pharmacyPhone.trim() || !glnNumber.trim()}
          >
            {submitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Kayit Ol
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/kayit")({
  component: RegistrationPage,
});
