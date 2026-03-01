import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { useDialog } from "@/hooks/useDialog";
import {
  subscriptionApiService,
  type PendingAgreement,
} from "@/services/subscription-api";

const REQUIRED_AGREEMENTS = ["terms-of-service", "kvkk"];

interface RegistrationFormValues {
  name: string;
  nameSurname: string;
  pharmacyPhone: string;
  glnNumber: string;
  tcNumber: string;
  address: string;
  phone: string;
  email: string;
  ipAddress: string;
}

function RegistrationPage() {
  const { pharmacy, isPending, ipAddress, loading, refresh } =
    useSubscription();
  const { showAlert } = useDialog();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    defaultValues: {
      name: "",
      nameSurname: "",
      pharmacyPhone: "",
      glnNumber: "",
      tcNumber: "",
      address: "",
      phone: "",
      email: "",
      ipAddress: ipAddress ?? "",
    },
  });

  // Agreements
  const [agreements, setAgreements] = useState<PendingAgreement[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [previewAgreement, setPreviewAgreement] =
    useState<PendingAgreement | null>(null);

  useEffect(() => {
    subscriptionApiService
      .getRegistrationAgreements(REQUIRED_AGREEMENTS)
      .then(setAgreements);
  }, []);

  const allAgreementsAccepted =
    agreements.length === 0 || agreements.every((a) => acceptedIds.has(a.id));

  const toggleAgreement = (id: string) => {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onSubmit = async (data: RegistrationFormValues) => {
    if (!allAgreementsAccepted) {
      showAlert({
        title: "Uyarı",
        description: "Devam etmek için tüm sözleşmeleri kabul etmelisiniz.",
      });
      return;
    }

    try {
      await subscriptionApiService.registerPharmacy({
        name: data.name.trim(),
        nameSurname: data.nameSurname.trim(),
        pharmacyPhone: data.pharmacyPhone.trim(),
        glnNumber: data.glnNumber.trim(),
        tcNumber: data.tcNumber.trim() || undefined,
        address: data.address.trim() || undefined,
        phone: data.phone.trim() || undefined,
        email: data.email.trim() || undefined,
        ipAddress: data.ipAddress.trim() || undefined,
        acceptedAgreementVersionIds: [...acceptedIds],
      });
      showAlert({
        title: "Başarılı",
        description: "Eczane kaydınız alındı. Yönetici onayı bekleniyor.",
      });
      await refresh();
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Kayıt işlemi sırasında bir hata oluştu.";
      showAlert({
        title: "Hata",
        description: message,
      });
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

  // No pharmacy — registration form
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

      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Yeni Eczane Kaydı</CardTitle>
            <CardDescription>
              Eczane bilgilerinizi girin. Kaydınız yönetici onayı sonrası aktif
              olacaktır.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pharmacy-name">
                Eczane Adı <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pharmacy-name"
                {...register("name", { required: "Eczane adı zorunludur" })}
                placeholder="Örnek: Merkez Eczanesi"
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy-name-surname">
                Ad Soyad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pharmacy-name-surname"
                {...register("nameSurname", {
                  required: "Ad soyad zorunludur",
                })}
                placeholder="Eczacı ad soyad"
              />
              {errors.nameSurname && (
                <p className="text-xs text-destructive">
                  {errors.nameSurname.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy-tc">
                TC Kimlik No <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pharmacy-tc"
                {...register("tcNumber", {
                  required: "TC Kimlik No zorunludur",
                  pattern: {
                    value: /^\d{11}$/,
                    message: "TC Kimlik No 11 haneli olmalıdır",
                  },
                })}
                placeholder="12345678901"
                maxLength={11}
              />
              {errors.tcNumber && (
                <p className="text-xs text-destructive">
                  {errors.tcNumber.message}
                </p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pharmacy-pharmacy-phone">
                  Eczane Telefonu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pharmacy-pharmacy-phone"
                  type="tel"
                  {...register("pharmacyPhone", {
                    required: "Eczane telefonu zorunludur",
                  })}
                  placeholder="0 (2XX) XXX XX XX"
                />
                {errors.pharmacyPhone && (
                  <p className="text-xs text-destructive">
                    {errors.pharmacyPhone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pharmacy-gln-number">
                  GLN Numarası <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pharmacy-gln-number"
                  {...register("glnNumber", {
                    required: "GLN numarası zorunludur",
                  })}
                  placeholder="GLN numarası"
                />
                {errors.glnNumber && (
                  <p className="text-xs text-destructive">
                    {errors.glnNumber.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy-address">Adres</Label>
              <Input
                id="pharmacy-address"
                {...register("address")}
                placeholder="Eczane adresi"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pharmacy-phone">Telefon (Kişisel)</Label>
                <Input
                  id="pharmacy-phone"
                  type="tel"
                  {...register("phone")}
                  placeholder="0 (5XX) XXX XX XX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pharmacy-email">E-posta</Label>
                <Input
                  id="pharmacy-email"
                  type="email"
                  {...register("email")}
                  placeholder="eczane@ornek.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="pharmacy-ip"
                className="flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                IP Adresi
              </Label>
              <Input
                id="pharmacy-ip"
                {...register("ipAddress")}
                placeholder="Otomatik algılanır"
              />
              <p className="text-xs text-muted-foreground">
                Mevcut IP adresiniz otomatik olarak dolduruldu. Gerekirse
                değiştirebilirsiniz.
              </p>
            </div>
            {agreements.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">
                  Sözleşmeler <span className="text-destructive">*</span>
                </Label>
                {agreements.map((agreement) => (
                  <div
                    key={agreement.id}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`agreement-${agreement.id}`}
                      checked={acceptedIds.has(agreement.id)}
                      onCheckedChange={() => toggleAgreement(agreement.id)}
                    />
                    <label
                      htmlFor={`agreement-${agreement.id}`}
                      className="cursor-pointer text-sm"
                    >
                      <button
                        type="button"
                        className="underline font-medium text-primary hover:text-primary/80"
                        onClick={() => setPreviewAgreement(agreement)}
                      >
                        {agreement.category?.name || agreement.title}
                      </button>
                      {"'ni okudum ve kabul ediyorum."}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          {/* Agreement preview modal */}
          <Dialog
            open={!!previewAgreement}
            onOpenChange={() => setPreviewAgreement(null)}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {previewAgreement?.category?.name || previewAgreement?.title}
                </DialogTitle>
              </DialogHeader>
              <div
                className="max-h-96 overflow-y-auto rounded-md border p-4 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: previewAgreement?.content || "",
                }}
              />
            </DialogContent>
          </Dialog>

          <CardFooter>
            <Button
              type="submit"
              disabled={isSubmitting || !allAgreementsAccepted}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Kayıt Ol
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/kayit")({
  component: RegistrationPage,
});
