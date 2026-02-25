import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings,
  CreditCard,
  CheckCircle2,
  Calendar,
  User,
  Eye,
  EyeOff,
  Save,
  Coins,
  AlertCircle,
  XCircle,
  Building2,
  Clock,
  RefreshCw,
  Download,
  Info,
  Trash2,
  Wallet,
  ShieldCheck,
  Plus,
  RotateCw,
  PauseCircle,
  Phone,
  Hash,
  MapPin,
  Mail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import { useModal } from "@/hooks/useModal";
import { useDialogContext } from "@/contexts/dialog-context";
import { SubscriptionModal } from "@/components/subscription-modal";
import { CreditPackagesModal } from "@/components/credit-packages-modal";
import { toast } from "sonner";
import { ModalProvider } from "@/components/modal-provider";
import { useState, useEffect, useCallback } from "react";
import { subscriptionApiService } from "@/services/subscription-api";
import { useCredentials } from "@/contexts/credentials-context";
import { ipc } from "@/ipc/manager";
import { version as appVersion } from "../../package.json";
import type { SavedCard, CardInfo } from "@/types/subscription";
import { reportApiService } from "@/services/report-api";
import { syncReportsFromServer } from "@/lib/db";
import { SYNC_DEFAULT_LOOKBACK_DAYS } from "@/lib/constants";

type SettingsSection = "eczane" | "medula" | "abonelik" | "odeme" | "senkronizasyon" | "uygulama";

interface SidebarItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: "eczane",
    label: "Eczane Bilgileri",
    icon: Building2,
    description: "Eczane ve eczacı bilgileri",
  },
  {
    id: "medula",
    label: "Medula Ayarları",
    icon: User,
    description: "SGK kimlik bilgileri",
  },
  {
    id: "abonelik",
    label: "Abonelik",
    icon: Wallet,
    description: "Plan ve yenileme bilgileri",
  },
  {
    id: "odeme",
    label: "Ödeme Yöntemleri",
    icon: CreditCard,
    description: "Kayıtlı kartlar",
  },
  {
    id: "senkronizasyon",
    label: "Senkronizasyon",
    icon: RefreshCw,
    description: "Veri senkronizasyonu",
  },
  {
    id: "uygulama",
    label: "Uygulama",
    icon: Info,
    description: "Sürüm ve güncellemeler",
  },
];

const EMPTY_CARD: CardInfo = {
  cardNumber: "",
  cardHolderName: "",
  expireMonth: "",
  expireYear: "",
  cvc: "",
};

function SettingsPage() {
  const {
    pharmacy,
    isPending,
    ipAddress,
    currentSubscription,
    creditBalance,
    currentProduct,
    currentVariant,
    loading,
    error,
    refresh,
  } = useSubscription();

  const { modal, openModal, closeModal } = useModal();
  const { showConfirmDialog } = useDialogContext();
  const [activeSection, setActiveSection] = useState<SettingsSection>("eczane");
  const [cancelling, setCancelling] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "up-to-date" | "update-available" | "error" | "dev"
  >("idle");
  const [updateMessage, setUpdateMessage] = useState("");

  // Sync state
  const SYNC_KEY = "kolayrapor_lastSyncedAt";
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => localStorage.getItem(SYNC_KEY),
  );
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const since =
        lastSyncedAt ||
        new Date(Date.now() - SYNC_DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const reports = await reportApiService.getMyReports(since);
      let synced = 0;
      if (reports.length > 0) {
        synced = await syncReportsFromServer(reports);
      }
      const now = new Date().toISOString();
      localStorage.setItem(SYNC_KEY, now);
      setLastSyncedAt(now);
      setSyncResult(
        synced > 0
          ? `${synced} yeni rapor senkronize edildi.`
          : "Tum raporlar guncel, yeni rapor bulunamadi.",
      );
    } catch {
      setSyncResult("Senkronizasyon sirasinda bir hata olustu.");
    } finally {
      setSyncing(false);
    }
  }, [lastSyncedAt]);

  // Saved cards
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Add card form
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState<CardInfo>(EMPTY_CARD);
  const [addingCard, setAddingCard] = useState(false);

  const loadSavedCards = useCallback(async () => {
    if (!pharmacy || isPending) return;
    setLoadingCards(true);
    try {
      const cards = await subscriptionApiService.getSavedCards();
      setSavedCards(cards);
    } catch {
      // Silently fail — cards section will show empty
    } finally {
      setLoadingCards(false);
    }
  }, [pharmacy, isPending]);

  useEffect(() => {
    loadSavedCards();
  }, [loadSavedCards]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newCard.cardNumber ||
      !newCard.cardHolderName ||
      !newCard.expireMonth ||
      !newCard.expireYear ||
      !newCard.cvc
    ) {
      toast.warning("Lütfen tüm kart bilgilerini doldurun.");
      return;
    }

    setAddingCard(true);
    try {
      const saved = await subscriptionApiService.addCard(newCard);
      setSavedCards((prev) => [...prev, saved]);
      setNewCard(EMPTY_CARD);
      setShowAddCard(false);
      toast.success("Kart başarıyla kaydedildi.");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Kart kaydedilirken bir hata oluştu.";
      toast.error(message);
    } finally {
      setAddingCard(false);
    }
  };

  const handleDeleteCard = (cardId: string, maskedNumber: string) => {
    showConfirmDialog({
      title: "Kartı Sil",
      description: `${maskedNumber} numaralı kartı silmek istediğinize emin misiniz?`,
      confirmText: "Sil",
      cancelText: "Vazgeç",
      variant: "destructive",
      onConfirm: async () => {
        setDeletingCardId(cardId);
        try {
          const removed = await subscriptionApiService.removeCard(cardId);
          if (removed) {
            setSavedCards((prev) => prev.filter((c) => c.id !== cardId));
            toast.success("Kart başarıyla silindi.");
          } else {
            toast.error("Kart silinirken bir hata oluştu.");
          }
        } catch {
          toast.error("Kart silinirken bir hata oluştu.");
        } finally {
          setDeletingCardId(null);
        }
      },
    });
  };

  const handleCheckStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      await refresh();
    } finally {
      setCheckingStatus(false);
    }
  }, [refresh]);

  const handleCheckForUpdates = useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateStatus("idle");
    setUpdateMessage("");
    try {
      const result = await ipc.client.app.checkForUpdates();
      setUpdateStatus(result.status);
      if (result.status === "update-available") {
        setUpdateMessage(
          "Yeni bir güncelleme mevcut! İndirme arka planda başladı.",
        );
      } else if (result.status === "up-to-date") {
        setUpdateMessage("Uygulamanız güncel.");
      } else if (result.status === "dev") {
        setUpdateMessage("Geliştirme modunda güncelleme kontrolü devre dışı.");
      } else {
        setUpdateMessage(result.message || "Güncelleme kontrolü başarısız.");
      }
    } catch {
      setUpdateStatus("error");
      setUpdateMessage("Güncelleme kontrolü sırasında bir hata oluştu.");
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  // Credentials from shared context
  const {
    credentials,
    setCredentials: saveCredentials,
    clearCredentials,
  } = useCredentials();

  // Local form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Sync local form state with context credentials
  useEffect(() => {
    if (credentials) {
      setUsername(credentials.username || "");
      setPassword(credentials.password || "");
      setCredentialsSaved(true);
    } else {
      setUsername("");
      setPassword("");
      setCredentialsSaved(false);
    }
  }, [credentials]);

  const handleSaveCredentials = async () => {
    if (!username || !password) {
      toast.warning("Lütfen kullanıcı adı ve şifre girin.");
      return;
    }

    setSavingCredentials(true);
    try {
      await saveCredentials({
        username,
        password,
        loginTime: new Date().toISOString(),
      });
      setCredentialsSaved(true);
      toast.success("Kimlik bilgileri kaydedildi.");
    } catch {
      toast.error("Kimlik bilgileri kaydedilirken hata oluştu.");
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleClearCredentials = async () => {
    await clearCredentials();
    setUsername("");
    setPassword("");
    setCredentialsSaved(false);
    toast.info("Kimlik bilgileri silindi.");
  };

  const handleViewAllPlans = () => {
    openModal(<SubscriptionModal onClose={closeModal} />, {
      size: "6xl",
      showCloseButton: true,
    });
  };

  const handleCancelSubscription = () => {
    showConfirmDialog({
      title: "Aboneliği İptal Et",
      description:
        "Aboneliğinizi iptal etmek istediğinize emin misiniz? Mevcut dönem sonuna kadar hizmet almaya devam edeceksiniz.",
      confirmText: "İptal Et",
      cancelText: "Vazgeç",
      variant: "destructive",
      onConfirm: async () => {
        setCancelling(true);
        try {
          const result = await subscriptionApiService.cancelSubscription();
          if (result.success) {
            toast.success(result.message || "Abonelik iptal edildi.");
            await refresh();
          } else {
            toast.error(result.error || "İptal işlemi başarısız oldu.");
          }
        } catch {
          toast.error("İptal işlemi sırasında bir hata oluştu.");
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  const getCardTypeColor = (cardType: string) => {
    switch (cardType) {
      case "VISA":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "MasterCard":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "TROY":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Aktif
          </Badge>
        );
      case "suspended":
        return (
          <Badge
            variant="secondary"
            className="gap-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          >
            <PauseCircle className="h-3 w-3" />
            Askıda
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive" className="gap-1 text-xs">
            <XCircle className="h-3 w-3" />
            Süresi Dolmuş
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="gap-1 text-xs">
            <XCircle className="h-3 w-3" />
            İptal Edildi
          </Badge>
        );
      default:
        return null;
    }
  };

  // ─── Pharmacy Edit State ────────────────────────────────
  const [pharmacyForm, setPharmacyForm] = useState({
    name: pharmacy?.name || "",
    nameSurname: pharmacy?.nameSurname || "",
    pharmacyPhone: pharmacy?.pharmacyPhone || "",
    glnNumber: pharmacy?.glnNumber || "",
    address: pharmacy?.address || "",
    phone: pharmacy?.phone || "",
    email: pharmacy?.email || "",
  });
  const [savingPharmacy, setSavingPharmacy] = useState(false);

  useEffect(() => {
    if (pharmacy) {
      setPharmacyForm({
        name: pharmacy.name || "",
        nameSurname: pharmacy.nameSurname || "",
        pharmacyPhone: pharmacy.pharmacyPhone || "",
        glnNumber: pharmacy.glnNumber || "",
        address: pharmacy.address || "",
        phone: pharmacy.phone || "",
        email: pharmacy.email || "",
      });
    }
  }, [pharmacy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleSavePharmacy = async () => {
    if (!pharmacyForm.name.trim() || !pharmacyForm.nameSurname.trim() || !pharmacyForm.pharmacyPhone.trim() || !pharmacyForm.glnNumber.trim()) {
      toast.warning("Eczane adi, ad soyad, eczane telefonu ve GLN numarasi zorunludur.");
      return;
    }
    setSavingPharmacy(true);
    try {
      await subscriptionApiService.updateMyPharmacy({
        name: pharmacyForm.name.trim(),
        nameSurname: pharmacyForm.nameSurname.trim(),
        pharmacyPhone: pharmacyForm.pharmacyPhone.trim(),
        glnNumber: pharmacyForm.glnNumber.trim(),
        address: pharmacyForm.address.trim() || undefined,
        phone: pharmacyForm.phone.trim() || undefined,
        email: pharmacyForm.email.trim() || undefined,
      });
      toast.success("Eczane bilgileri guncellendi.");
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Guncelleme sirasinda hata olustu.");
    } finally {
      setSavingPharmacy(false);
    }
  };

  // ─── Section Renderers ───────────────────────────────────

  const renderEczaneSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Eczane Bilgileri</h2>
        <p className="text-sm text-muted-foreground">
          Eczane ve eczaci bilgilerinizi goruntuleyin ve duzenleyin
        </p>
      </div>

      {!pharmacy ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Eczane kaydi bulunamadi</p>
                <p className="text-sm text-muted-foreground">
                  Bilgilerinizi duzenlemek icin once eczanenizi kaydedin.
                </p>
                {ipAddress && (
                  <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                    IP Adresiniz: {ipAddress}
                  </p>
                )}
                <Link to="/kayit">
                  <Button variant="outline" size="sm">
                    <Building2 className="h-4 w-4 mr-2" />
                    Eczane Kaydina Git
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isPending ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Eczane kaydiniz onay bekliyor</p>
                <p className="text-sm text-muted-foreground">
                  Onaylandiktan sonra bilgilerinizi duzenleyebilirsiniz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ph-name">
                  Eczane Adi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-name"
                  value={pharmacyForm.name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                  placeholder="Eczane adi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph-nameSurname">
                  Ad Soyad <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-nameSurname"
                  value={pharmacyForm.nameSurname}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, nameSurname: e.target.value })}
                  placeholder="Eczaci ad soyad"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ph-pharmacyPhone">
                  Eczane Telefonu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-pharmacyPhone"
                  type="tel"
                  value={pharmacyForm.pharmacyPhone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, pharmacyPhone: e.target.value })}
                  placeholder="0 (2XX) XXX XX XX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph-glnNumber">
                  GLN Numarasi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-glnNumber"
                  value={pharmacyForm.glnNumber}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, glnNumber: e.target.value })}
                  placeholder="GLN numarasi"
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ph-address">Adres</Label>
                <Input
                  id="ph-address"
                  value={pharmacyForm.address}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, address: e.target.value })}
                  placeholder="Eczane adresi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph-phone">Telefon (Kisisel)</Label>
                <Input
                  id="ph-phone"
                  type="tel"
                  value={pharmacyForm.phone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                  placeholder="0 (5XX) XXX XX XX"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ph-email">E-posta</Label>
                <Input
                  id="ph-email"
                  type="email"
                  value={pharmacyForm.email}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, email: e.target.value })}
                  placeholder="eczane@ornek.com"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSavePharmacy}
                disabled={savingPharmacy || !pharmacyForm.name.trim() || !pharmacyForm.nameSurname.trim() || !pharmacyForm.pharmacyPhone.trim() || !pharmacyForm.glnNumber.trim()}
                size="sm"
              >
                {savingPharmacy ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Kaydet
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderMedulaSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Medula Ayarları</h2>
        <p className="text-sm text-muted-foreground">
          SGK Eczane portalı giriş bilgilerinizi yönetin
        </p>
      </div>

      {!pharmacy ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Eczane kaydı bulunamadı</p>
                <p className="text-sm text-muted-foreground">
                  SGK kimlik bilgilerinizi kaydetmek için önce eczanenizi
                  kaydetmeniz gerekmektedir.
                </p>
                {ipAddress && (
                  <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                    IP Adresiniz: {ipAddress}
                  </p>
                )}
                <Link to="/kayit">
                  <Button variant="outline" size="sm">
                    <Building2 className="h-4 w-4 mr-2" />
                    Eczane Kaydına Git
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isPending ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Eczane kaydınız onay bekliyor
                </p>
                <p className="text-sm text-muted-foreground">
                  Eczane kaydınız onaylandıktan sonra SGK kimlik bilgilerinizi
                  kaydedebilirsiniz.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                  className="mt-2"
                >
                  {checkingStatus ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Kontrol Ediliyor...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Durumu Kontrol Et
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                SGK Eczane portalına giriş için kullanıcı bilgileriniz
              </p>
              {credentialsSaved && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Kayıtlı
                </Badge>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setCredentialsSaved(false);
                  }}
                  placeholder="Kullanıcı adınızı girin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setCredentialsSaved(false);
                    }}
                    placeholder="Şifrenizi girin"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveCredentials}
                disabled={savingCredentials || (!username && !password)}
                size="sm"
              >
                {savingCredentials ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Kaydet
                  </>
                )}
              </Button>
              {credentialsSaved && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearCredentials}
                >
                  Temizle
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderAbonelikSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Abonelik</h2>
        <p className="text-sm text-muted-foreground">
          Abonelik planınız, kredi bakiyeniz ve yenileme durumu
        </p>
      </div>

      {/* Credit + Subscription summary */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Credit Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Coins className="h-4 w-4" />
                  Kalan Kredi
                </p>
                {creditBalance ? (
                  <p className="text-3xl font-bold">
                    {Number(creditBalance.balance).toFixed(0)}
                    <span className="text-base font-normal text-muted-foreground ml-1">
                      kredi
                    </span>
                  </p>
                ) : pharmacy ? (
                  <p className="text-3xl font-bold">
                    0
                    <span className="text-base font-normal text-muted-foreground ml-1">
                      kredi
                    </span>
                  </p>
                ) : (
                  <p className="text-lg text-muted-foreground">—</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openModal(<CreditPackagesModal />, {
                    size: "4xl",
                    showCloseButton: true,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Satın Al
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  Mevcut Abonelik
                </p>
                {currentSubscription ? (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">
                      {currentProduct?.name}
                    </p>
                    {getStatusBadge(currentSubscription.status)}
                  </div>
                ) : (
                  <p className="text-lg text-muted-foreground">
                    Aktif abonelik yok
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleViewAllPlans}>
                Planlar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active/Suspended Subscription Details */}
      {currentSubscription &&
        (currentSubscription.status === "active" ||
          currentSubscription.status === "suspended") && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium">
                    {currentVariant?.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Başlangıç
                  </p>
                  <p className="text-sm font-medium">
                    {currentSubscription.startDate
                      ? new Date(
                          currentSubscription.startDate,
                        ).toLocaleDateString("tr-TR")
                      : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Bitiş
                  </p>
                  <p className="text-sm font-medium">
                    {currentSubscription.endDate
                      ? new Date(
                          currentSubscription.endDate,
                        ).toLocaleDateString("tr-TR")
                      : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Ücret</p>
                  <p className="text-sm font-bold">
                    ₺{currentVariant?.price}
                  </p>
                </div>
              </div>

              {/* Renewal Info */}
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Yenileme Bilgileri
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <RotateCw className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Otomatik Yenileme
                      </p>
                      <p className="text-sm font-medium">
                        {currentSubscription.autoRenew ? (
                          <span className="text-green-600 dark:text-green-400">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Kapalı
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Sonraki Ödeme Tarihi
                      </p>
                      <p className="text-sm font-medium">
                        {currentSubscription.nextBillingDate
                          ? new Date(
                              currentSubscription.nextBillingDate,
                            ).toLocaleDateString("tr-TR")
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {currentSubscription.autoRenew && savedCards.length > 0 && (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Yenileme Kartı
                        </p>
                        <p className="text-sm font-medium">
                          {(
                            savedCards.find((c) => c.isDefault) || savedCards[0]
                          ).maskedCardNumber}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentSubscription.status === "suspended" && (
                    <div className="flex items-center gap-3 rounded-lg border border-yellow-200 dark:border-yellow-800 p-3 bg-yellow-50 dark:bg-yellow-900/10">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Yenileme Durumu
                        </p>
                        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                          Ödeme başarısız — Deneme{" "}
                          {currentSubscription.renewalRetryCount}/3
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {currentSubscription.status === "suspended" && (
                  <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 p-3 bg-yellow-50 dark:bg-yellow-900/10">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-300">
                          Aboneliğiniz askıya alındı
                        </p>
                        <p className="text-yellow-700/80 dark:text-yellow-400/80 mt-1">
                          Kayıtlı kartınızdan ödeme alınamadı. Sistem saatlik
                          olarak tekrar deneyecektir. 3 başarısız denemeden sonra
                          aboneliğiniz sona erecektir. Lütfen kart bilgilerinizi
                          kontrol edin.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Features */}
              {currentProduct?.features &&
                currentProduct.features.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Dahil Olan Özellikler
                      </p>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {currentProduct.features.map((feature, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

              {/* Request usage */}
              {currentVariant && currentVariant.maxRequests > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Kullanım</p>
                    <p className="text-sm font-medium">
                      {currentSubscription.requestCount} /{" "}
                      {currentVariant.maxRequests} sorgu
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      İptal Ediliyor...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Aboneliği İptal Et
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );

  const renderOdemeSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ödeme Yöntemleri</h2>
          <p className="text-sm text-muted-foreground">
            Kayıtlı kartlarınızı yönetin ve yeni kart ekleyin
          </p>
        </div>
        {pharmacy && !isPending && !showAddCard && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCard(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Kart Ekle
          </Button>
        )}
      </div>

      {!pharmacy || isPending ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isPending
                    ? "Eczane kaydınız onay bekliyor"
                    : "Eczane kaydı gerekli"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPending
                    ? "Onay sonrası kart işlemlerini yapabilirsiniz."
                    : "Kart kaydetmek için önce eczanenizi kaydedin."}
                </p>
                {!isPending && ipAddress && (
                  <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                    IP Adresiniz: {ipAddress}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Add Card Form */}
          {showAddCard && (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleAddCard} className="space-y-4">
                  <p className="text-sm font-medium">Yeni Kart Bilgileri</p>

                  <div className="space-y-2">
                    <Label htmlFor="newCardNumber">Kart Numarası</Label>
                    <Input
                      id="newCardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={formatCardNumber(newCard.cardNumber)}
                      onChange={(e) =>
                        setNewCard({
                          ...newCard,
                          cardNumber: e.target.value.replace(/\s/g, ""),
                        })
                      }
                      required
                      maxLength={19}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newCardHolder">Kart Sahibi</Label>
                    <Input
                      id="newCardHolder"
                      placeholder="AD SOYAD"
                      value={newCard.cardHolderName}
                      onChange={(e) =>
                        setNewCard({
                          ...newCard,
                          cardHolderName: e.target.value.toUpperCase(),
                        })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="newExpireMonth">Ay</Label>
                      <Input
                        id="newExpireMonth"
                        placeholder="MM"
                        value={newCard.expireMonth}
                        onChange={(e) =>
                          setNewCard({
                            ...newCard,
                            expireMonth: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 2),
                          })
                        }
                        required
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newExpireYear">Yıl</Label>
                      <Input
                        id="newExpireYear"
                        placeholder="YY"
                        value={newCard.expireYear}
                        onChange={(e) =>
                          setNewCard({
                            ...newCard,
                            expireYear: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 2),
                          })
                        }
                        required
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newCvc">CVC</Label>
                      <Input
                        id="newCvc"
                        placeholder="000"
                        type="password"
                        value={newCard.cvc}
                        onChange={(e) =>
                          setNewCard({
                            ...newCard,
                            cvc: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4),
                          })
                        }
                        required
                        maxLength={4}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Kart bilgileri banka tarafında güvenle saklanır.
                      Sunucularımızda kart numarası tutulmaz.
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={addingCard}>
                      {addingCard ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Kaydediliyor...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Kartı Kaydet
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddCard(false);
                        setNewCard(EMPTY_CARD);
                      }}
                      disabled={addingCard}
                    >
                      Vazgeç
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Saved Cards List */}
          <Card>
            <CardContent className="pt-6">
              {loadingCards ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner size="md" />
                </div>
              ) : savedCards.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Kayıtlı kartınız bulunmuyor
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Yukarıdaki &quot;Kart Ekle&quot; butonu ile yeni kart
                      ekleyebilirsiniz
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedCards.map((sc) => (
                    <div
                      key={sc.id}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">
                            {sc.maskedCardNumber}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${getCardTypeColor(sc.cardType)}`}
                          >
                            {sc.cardType}
                          </span>
                          {sc.isDefault && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Varsayılan
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {sc.cardHolderName} &middot; {sc.expireMonth}/
                          {sc.expireYear}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={deletingCardId === sc.id}
                        onClick={() =>
                          handleDeleteCard(sc.id, sc.maskedCardNumber)
                        }
                      >
                        {deletingCardId === sc.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Kart bilgileri banka tarafında güvenle saklanır.
                      Sunucularımızda kart numarası tutulmaz.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  const renderSenkronizasyonSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Senkronizasyon</h2>
        <p className="text-sm text-muted-foreground">
          Sunucudaki rapor verilerinizi yerel onbellege senkronize edin
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Son Senkronizasyon
              </p>
              <p className="text-lg font-semibold">
                {lastSyncedAt
                  ? new Date(lastSyncedAt).toLocaleString("tr-TR")
                  : "Henuz senkronize edilmedi"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || !pharmacy || isPending}
            >
              {syncing ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Senkronize Ediliyor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Simdi Senkronize Et
                </>
              )}
            </Button>
          </div>
          {syncResult && (
            <p className="text-sm text-muted-foreground">{syncResult}</p>
          )}
          {(!pharmacy || isPending) && (
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Senkronizasyon icin aktif bir eczane kaydi gereklidir.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderUygulamaSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Uygulama</h2>
        <p className="text-sm text-muted-foreground">
          Sürüm bilgisi ve güncelleme kontrolü
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sürüm</p>
              <p className="text-lg font-semibold font-mono">v{appVersion}</p>
            </div>
            <div className="flex items-center gap-2">
              {updateStatus === "up-to-date" && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Güncel
                </Badge>
              )}
              {updateStatus === "update-available" && (
                <Badge variant="secondary" className="gap-1">
                  <Download className="h-3 w-3" />
                  Güncelleme Mevcut
                </Badge>
              )}
              {updateStatus === "error" && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Hata
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
              >
                {checkingUpdate ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Kontrol...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Güncelleme Kontrol Et
                  </>
                )}
              </Button>
            </div>
          </div>
          {updateMessage && (
            <p className="text-sm text-muted-foreground mt-3">
              {updateMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "eczane":
        return renderEczaneSection();
      case "medula":
        return renderMedulaSection();
      case "abonelik":
        return renderAbonelikSection();
      case "odeme":
        return renderOdemeSection();
      case "senkronizasyon":
        return renderSenkronizasyonSection();
      case "uygulama":
        return renderUygulamaSection();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r bg-muted/30">
        <div className="p-4 space-y-1">
          <div className="flex items-center gap-2 px-2 pb-3">
            <Settings className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Ayarlar</h1>
          </div>
          <nav className="space-y-0.5">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p
                      className={`truncate ${isActive ? "text-foreground" : ""}`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Error Banner */}
          {error && (
            <Card className="border-destructive mb-6">
              <CardContent className="flex items-center gap-2 py-3">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={refresh}
                >
                  Tekrar Dene
                </Button>
              </CardContent>
            </Card>
          )}

          {renderContent()}
        </div>
      </div>

      <ModalProvider modal={modal} onClose={closeModal} />
    </div>
  );
}

export const Route = createFileRoute("/ayarlar")({
  component: SettingsPage,
});
