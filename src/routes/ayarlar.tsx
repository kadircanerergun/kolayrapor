import { createFileRoute } from '@tanstack/react-router';
import { Settings, CreditCard, CheckCircle2, Calendar, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useSubscription } from '@/hooks/useSubscription';
import { useModal } from '@/hooks/useModal';
import { useDialog } from '@/hooks/useDialog';
import { SubscriptionModal } from '@/components/subscription-modal';
import { ModalProvider } from '@/components/modal-provider';
import { cn } from '@/utils/tailwind';
import { useState } from 'react';
import { subscriptionApiService } from '@/services/subscription-api';

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
        showAlert(result.message || 'Abonelik yükseltme talebiniz alındı.');
      } else {
        showAlert(result.error || 'İşlem başarısız oldu.');
      }
    } catch (error) {
      showAlert('İşlem sırasında bir hata oluştu.');
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

      {/* Upgrade Options Section */}
      {hasUpgradeOptions && currentSubscription?.status === 'active' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Yükseltme Seçenekleri
            </h2>
            <p className="text-sm text-muted-foreground">
              Daha fazla özellik için planınızı yükseltin
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {upgradeOptions.map((product) => {
              const popularVariant = product.variants.find(v => v.isPopular) || product.variants[0];
              const isProcessing = subscribingTo?.startsWith(product.id);

              return (
                <Card
                  key={product.id}
                  className={cn(
                    'relative',
                    product.isRecommended && 'border-primary shadow-md'
                  )}
                >
                  {product.isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="default" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        Önerilen
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-xl">{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Features */}
                    <ul className="space-y-2">
                      {product.features.slice(0, 4).map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                      {product.features.length > 4 && (
                        <li className="text-sm text-muted-foreground pl-6">
                          +{product.features.length - 4} özellik daha
                        </li>
                      )}
                    </ul>

                    {/* Price */}
                    <div className="pt-2 border-t">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">₺{popularVariant?.price}</span>
                        {popularVariant?.originalPrice && (
                          <span className="text-sm text-muted-foreground line-through">
                            ₺{popularVariant.originalPrice}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {popularVariant?.duration} başına
                      </p>
                      {popularVariant?.discount && (
                        <Badge variant="secondary" className="text-xs mt-2">
                          %{popularVariant.discount} İndirim
                        </Badge>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={product.isRecommended ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(product.id, popularVariant?.id || '')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          İşleniyor...
                        </>
                      ) : (
                        'Yükselt'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <ModalProvider modal={modal} onClose={closeModal} />
    </div>
  );
}

export const Route = createFileRoute('/ayarlar')({
  component: SettingsPage,
});
