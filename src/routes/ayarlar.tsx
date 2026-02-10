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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import { useModal } from "@/hooks/useModal";
import { useDialog } from "@/hooks/useDialog";
import { SubscriptionModal } from "@/components/subscription-modal";
import { ModalProvider } from "@/components/modal-provider";
import { useState, useEffect, useCallback } from "react";
import { subscriptionApiService } from "@/services/subscription-api";
import { useCredentials } from "@/contexts/credentials-context";
import { ipc } from "@/ipc/manager";
import { version as appVersion } from "../../package.json";

function SettingsPage() {
  const {
    pharmacy,
    isPending,
    currentSubscription,
    creditBalance,
    currentProduct,
    currentVariant,
    loading,
    error,
    refresh,
  } = useSubscription();

  const { modal, openModal, closeModal } = useModal();
  const { showAlert, showConfirmDialog } = useDialog();
  const [cancelling, setCancelling] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "up-to-date" | "update-available" | "error" | "dev"
  >("idle");
  const [updateMessage, setUpdateMessage] = useState("");

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
      showAlert({
        title: "Uyarı",
        description: "Lütfen kullanıcı adı ve şifre girin.",
      });
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
      showAlert({
        title: "Başarılı",
        description: "Kimlik bilgileri kaydedildi.",
      });
    } catch {
      showAlert({
        title: "Hata",
        description: "Kimlik bilgileri kaydedilirken hata oluştu.",
      });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleClearCredentials = async () => {
    await clearCredentials();
    setUsername("");
    setPassword("");
    setCredentialsSaved(false);
    showAlert({ title: "Bilgi", description: "Kimlik bilgileri silindi." });
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
            showAlert({
              title: "Başarılı",
              description: result.message || "Abonelik iptal edildi.",
            });
            await refresh();
          } else {
            showAlert({
              title: "Hata",
              description: result.error || "İptal işlemi başarısız oldu.",
            });
          }
        } catch {
          showAlert({
            title: "Hata",
            description: "İptal işlemi sırasında bir hata oluştu.",
          });
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Ayarlar</h1>
        </div>
        <p className="text-muted-foreground">
          Hesap ve abonelik ayarlarınızı yönetin
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-destructive">
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

      {/* SGK Credentials Section */}
      {!pharmacy ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              SGK Kimlik Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/50">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Eczane kaydı bulunamadı
                </p>
                <p className="text-sm text-muted-foreground">
                  SGK kimlik bilgilerinizi kaydetmek için önce eczanenizi
                  kaydetmeniz gerekmektedir.
                </p>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              SGK Kimlik Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  SGK Kimlik Bilgileri
                </CardTitle>
                <CardDescription>
                  SGK Eczane portalına giriş için kullanıcı bilgileriniz
                </CardDescription>
              </div>
              {credentialsSaved && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Kayıtlı
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
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
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button
              onClick={handleSaveCredentials}
              disabled={savingCredentials || (!username && !password)}
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
              <Button variant="outline" onClick={handleClearCredentials}>
                Temizle
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Credit & Subscription Side by Side */}
      <div className="grid gap-6 md:grid-cols-2">
      {/* Remaining Credit Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Kalan Kredi
              </CardTitle>
              <CardDescription>
                Hesabınızdaki kullanılabilir kredi miktarı
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {creditBalance ? (
                <div className="space-y-1">
                  <div className="text-3xl font-bold">
                    {Number(creditBalance.balance).toFixed(0)}
                  </div>
                  <p className="text-sm text-muted-foreground">kredi</p>
                </div>
              ) : pharmacy ? (
                <div className="space-y-1">
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-sm text-muted-foreground">kredi</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-muted-foreground">
                    —
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Eczane kaydı bulunamadı
                  </p>
                </div>
              )}
            </div>
            <Link to="/subscription">
              <Button variant="outline" size="sm">
                <Coins className="h-4 w-4 mr-2" />
                Kredi Satın Al
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Current Subscription Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Mevcut Abonelik
              </CardTitle>
              <CardDescription>
                Aktif abonelik planınız ve detayları
              </CardDescription>
            </div>
            {currentSubscription?.status === "active" && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Aktif
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentSubscription && currentSubscription.status === "active" ? (
            <>
              {/* Current Plan Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-lg font-semibold">
                    {currentProduct?.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Süre</p>
                  <p className="text-lg font-semibold">
                    {currentVariant?.name}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Dates and Price */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Başlangıç Tarihi
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
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Bitiş Tarihi
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
                  <p className="text-sm text-muted-foreground">Ücret</p>
                  <p className="text-lg font-bold">
                    ₺{currentVariant?.price}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Features */}
              {currentProduct?.features &&
                currentProduct.features.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Dahil Olan Özellikler:
                    </p>
                    <ul className="grid gap-2 md:grid-cols-2">
                      {currentProduct.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Request usage */}
              {currentVariant && currentVariant.maxRequests > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Kullanım</p>
                    <p className="text-sm font-medium">
                      {currentSubscription.requestCount} /{" "}
                      {currentVariant.maxRequests} sorgu
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Henüz aktif bir aboneliğiniz bulunmamaktadır
              </p>
              <Button onClick={handleViewAllPlans}>Planları Görüntüle</Button>
            </div>
          )}
        </CardContent>

        {currentSubscription?.status === "active" && (
          <CardFooter className="flex gap-2">
            <Button variant="outline" onClick={handleViewAllPlans}>
              Tüm Planları Görüntüle
            </Button>
            <Button
              variant="destructive"
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
          </CardFooter>
        )}
      </Card>
      </div>

      {/* Version & Update Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Uygulama Bilgisi
          </CardTitle>
          <CardDescription>
            Mevcut sürüm ve güncelleme durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Mevcut Sürüm</p>
              <p className="text-lg font-semibold">v{appVersion}</p>
            </div>
            <div className="flex items-center gap-3">
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
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
              >
                {checkingUpdate ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Kontrol Ediliyor...
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

      <ModalProvider modal={modal} onClose={closeModal} />
    </div>
  );
}

export const Route = createFileRoute("/ayarlar")({
  component: SettingsPage,
});
