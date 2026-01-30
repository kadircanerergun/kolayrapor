import { createFileRoute } from '@tanstack/react-router';
import { Settings, CreditCard, CheckCircle2, Calendar, Sparkles, User, Eye, EyeOff, Save, Coins } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubscription } from '@/hooks/useSubscription';
import { useModal } from '@/hooks/useModal';
import { useDialog } from '@/hooks/useDialog';
import { SubscriptionModal } from '@/components/subscription-modal';
import { ModalProvider } from '@/components/modal-provider';
import { cn } from '@/utils/tailwind';
import { useState, useEffect } from 'react';
import { subscriptionApiService } from '@/services/subscription-api';
import { useCredentials } from '@/contexts/credentials-context';

function SettingsPage() {
  const {
    currentSubscription,
    currentProduct,
    currentVariant,
    upgradeOptions,
    hasUpgradeOptions,
    loading,
  } = useSubscription();

  const { modal, openModal, closeModal } = useModal();
  const { showAlert } = useDialog();
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

  // Credentials from shared context
  const { credentials, setCredentials: saveCredentials, clearCredentials } = useCredentials();

  // Local form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Remaining credit state (will be connected to data source later)
  const [remainingCredit, setRemainingCredit] = useState<number | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  // Sync local form state with context credentials
  useEffect(() => {
    if (credentials) {
      setUsername(credentials.username || '');
      setPassword(credentials.password || '');
      setCredentialsSaved(true);
    } else {
      setUsername('');
      setPassword('');
      setCredentialsSaved(false);
    }
  }, [credentials]);

  const handleSaveCredentials = async () => {
    if (!username || !password) {
      showAlert({ title: 'Uyarı', description: 'Lütfen kullanıcı adı ve şifre girin.' });
      return;
    }

    setSavingCredentials(true);
    try {
      await saveCredentials({
        username,
        password,
        loginTime: new Date().toISOString()
      });
      setCredentialsSaved(true);
      showAlert({ title: 'Başarılı', description: 'Kimlik bilgileri kaydedildi.' });
    } catch (error) {
      showAlert({ title: 'Hata', description: 'Kimlik bilgileri kaydedilirken hata oluştu.' });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleClearCredentials = async () => {
    await clearCredentials();
    setUsername('');
    setPassword('');
    setCredentialsSaved(false);
    showAlert({ title: 'Bilgi', description: 'Kimlik bilgileri silindi.' });
  };

  const handleViewAllPlans = () => {
    openModal(<SubscriptionModal onClose={closeModal} />, {
      size: '6xl',
      showCloseButton: true,
    });
  };

  const handleUpgrade = async (productId: string, variantId: string) => {
    setSubscribingTo(`${productId}-${variantId}`);

    try {
      const result = await subscriptionApiService.subscribe({
        productId,
        variantId,
      });

      if (result.success) {
        showAlert({ title: 'Başarılı', description: result.message || 'Abonelik yükseltme talebiniz alındı.' });
      } else {
        showAlert({ title: 'Hata', description: result.error || 'İşlem başarısız oldu.' });
      }
    } catch (error) {
      showAlert({ title: 'Hata', description: 'İşlem sırasında bir hata oluştu.' });
    } finally {
      setSubscribingTo(null);
    }
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

      {/* SGK Credentials Section */}
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
                  type={showPassword ? 'text' : 'password'}
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
              {creditLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-muted-foreground">Yükleniyor...</span>
                </div>
              ) : remainingCredit !== null ? (
                <div className="space-y-1">
                  <div className="text-3xl font-bold">{remainingCredit}</div>
                  <p className="text-sm text-muted-foreground">kredi</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-muted-foreground">—</div>
                  <p className="text-sm text-muted-foreground">Kredi bilgisi yüklenemedi</p>
                </div>
              )}
            </div>
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
            {currentSubscription?.status === 'active' && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Aktif
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentSubscription && currentSubscription.status === 'active' ? (
            <>
              {/* Current Plan Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-lg font-semibold">{currentProduct?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Süre</p>
                  <p className="text-lg font-semibold">{currentVariant?.name}</p>
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
                      ? new Date(currentSubscription.startDate).toLocaleDateString('tr-TR')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Bitiş Tarihi
                  </p>
                  <p className="text-sm font-medium">
                    {currentSubscription.endDate
                      ? new Date(currentSubscription.endDate).toLocaleDateString('tr-TR')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ücret</p>
                  <p className="text-lg font-bold">₺{currentVariant?.price}</p>
                </div>
              </div>

              <Separator />

              {/* Features */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Dahil Olan Özellikler:</p>
                <ul className="grid gap-2 md:grid-cols-2">
                  {currentProduct?.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Henüz aktif bir aboneliğiniz bulunmamaktadır
              </p>
              <Button onClick={handleViewAllPlans}>
                Planları Görüntüle
              </Button>
            </div>
          )}
        </CardContent>

        {currentSubscription?.status === 'active' && (
          <CardFooter className="flex gap-2">
            <Button variant="outline" onClick={handleViewAllPlans}>
              Tüm Planları Görüntüle
            </Button>
          </CardFooter>
        )}
      </Card>

      {/*/!* Upgrade Options Section *!/*/}
      {/*{hasUpgradeOptions && currentSubscription?.status === 'active' && (*/}
      {/*  <div className="space-y-4">*/}
      {/*    <div className="space-y-1">*/}
      {/*      <h2 className="text-xl font-semibold flex items-center gap-2">*/}
      {/*        <Sparkles className="h-5 w-5 text-primary" />*/}
      {/*        Yükseltme Seçenekleri*/}
      {/*      </h2>*/}
      {/*      <p className="text-sm text-muted-foreground">*/}
      {/*        Daha fazla özellik için planınızı yükseltin*/}
      {/*      </p>*/}
      {/*    </div>*/}

      {/*    <div className="grid gap-4 md:grid-cols-2">*/}
      {/*      {upgradeOptions.map((product) => {*/}
      {/*        const popularVariant = product.variants.find(v => v.isPopular) || product.variants[0];*/}
      {/*        const isProcessing = subscribingTo?.startsWith(product.id);*/}

      {/*        return (*/}
      {/*          <Card*/}
      {/*            key={product.id}*/}
      {/*            className={cn(*/}
      {/*              'relative',*/}
      {/*              product.isRecommended && 'border-primary shadow-md'*/}
      {/*            )}*/}
      {/*          >*/}
      {/*            {product.isRecommended && (*/}
      {/*              <div className="absolute -top-3 left-1/2 -translate-x-1/2">*/}
      {/*                <Badge variant="default" className="gap-1">*/}
      {/*                  <Sparkles className="h-3 w-3" />*/}
      {/*                  Önerilen*/}
      {/*                </Badge>*/}
      {/*              </div>*/}
      {/*            )}*/}

      {/*            <CardHeader>*/}
      {/*              <CardTitle className="text-xl">{product.name}</CardTitle>*/}
      {/*              <CardDescription>{product.description}</CardDescription>*/}
      {/*            </CardHeader>*/}

      {/*            <CardContent className="space-y-4">*/}
      {/*              /!* Features *!/*/}
      {/*              <ul className="space-y-2">*/}
      {/*                {product.features.slice(0, 4).map((feature, index) => (*/}
      {/*                  <li key={index} className="flex items-start gap-2 text-sm">*/}
      {/*                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />*/}
      {/*                    <span>{feature}</span>*/}
      {/*                  </li>*/}
      {/*                ))}*/}
      {/*                {product.features.length > 4 && (*/}
      {/*                  <li className="text-sm text-muted-foreground pl-6">*/}
      {/*                    +{product.features.length - 4} özellik daha*/}
      {/*                  </li>*/}
      {/*                )}*/}
      {/*              </ul>*/}

      {/*              /!* Price *!/*/}
      {/*              <div className="pt-2 border-t">*/}
      {/*                <div className="flex items-baseline gap-2">*/}
      {/*                  <span className="text-2xl font-bold">₺{popularVariant?.price}</span>*/}
      {/*                  {popularVariant?.originalPrice && (*/}
      {/*                    <span className="text-sm text-muted-foreground line-through">*/}
      {/*                      ₺{popularVariant.originalPrice}*/}
      {/*                    </span>*/}
      {/*                  )}*/}
      {/*                </div>*/}
      {/*                <p className="text-xs text-muted-foreground mt-1">*/}
      {/*                  {popularVariant?.duration} başına*/}
      {/*                </p>*/}
      {/*                {popularVariant?.discount && (*/}
      {/*                  <Badge variant="secondary" className="text-xs mt-2">*/}
      {/*                    %{popularVariant.discount} İndirim*/}
      {/*                  </Badge>*/}
      {/*                )}*/}
      {/*              </div>*/}
      {/*            </CardContent>*/}

      {/*            <CardFooter>*/}
      {/*              <Button*/}
      {/*                className="w-full"*/}
      {/*                variant={product.isRecommended ? 'default' : 'outline'}*/}
      {/*                onClick={() => handleUpgrade(product.id, popularVariant?.id || '')}*/}
      {/*                disabled={isProcessing}*/}
      {/*              >*/}
      {/*                {isProcessing ? (*/}
      {/*                  <>*/}
      {/*                    <Spinner size="sm" className="mr-2" />*/}
      {/*                    İşleniyor...*/}
      {/*                  </>*/}
      {/*                ) : (*/}
      {/*                  'Yükselt'*/}
      {/*                )}*/}
      {/*              </Button>*/}
      {/*            </CardFooter>*/}
      {/*          </Card>*/}
      {/*        );*/}
      {/*      })}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}

      <ModalProvider modal={modal} onClose={closeModal} />
    </div>
  );
}

export const Route = createFileRoute('/ayarlar')({
  component: SettingsPage,
});
