import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { subscriptionApiService } from "@/services/subscription-api";
import type {
  CardInfo,
  SubscriptionProduct,
  SubscriptionVariant,
  CreditPackage,
  SavedCard,
} from "@/types/subscription";
import { useSubscription } from "@/hooks/useSubscription";
import { useDialog } from "@/hooks/useDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Coins,
  ShieldCheck,
  Trash2,
} from "lucide-react";

interface OdemeSearch {
  type: "subscription" | "credit";
  id: string;
}

const EMPTY_CARD: CardInfo = {
  cardNumber: "",
  cardHolderName: "",
  expireMonth: "",
  expireYear: "",
  cvc: "",
};

type PaymentMode = "saved" | "new";

function OdemePage() {
  const { type, id } = Route.useSearch();
  const navigate = useNavigate();
  const { pharmacy, isPending, refresh } = useSubscription();
  const { showAlert } = useDialog();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [card, setCard] = useState<CardInfo>(EMPTY_CARD);
  const [saveCard, setSaveCard] = useState(false);

  // Saved cards
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("new");

  // Subscription data
  const [product, setProduct] = useState<SubscriptionProduct | null>(null);
  const [variant, setVariant] = useState<SubscriptionVariant | null>(null);

  // Credit data
  const [creditPackage, setCreditPackage] = useState<CreditPackage | null>(
    null,
  );

  useEffect(() => {
    loadData();
  }, [type, id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load saved cards and product data in parallel
      const [cards] = await Promise.all([
        subscriptionApiService.getSavedCards(),
        loadProductData(),
      ]);

      setSavedCards(cards);
      if (cards.length > 0) {
        const defaultCard = cards.find((c) => c.isDefault) || cards[0];
        setSelectedCardId(defaultCard.id);
        setPaymentMode("saved");
      }
    } catch {
      showAlert({
        title: "Hata",
        description: "Veriler yüklenirken bir hata oluştu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProductData = async () => {
    if (type === "subscription") {
      const products = await subscriptionApiService.getProducts();
      for (const p of products) {
        const v = p.variants.find((v) => v.id === id);
        if (v) {
          setProduct(p);
          setVariant(v);
          break;
        }
      }
    } else {
      const packages = await subscriptionApiService.getCreditPackages();
      const pkg = packages.find((p) => p.id === id);
      if (pkg) {
        setCreditPackage(pkg);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (type === "subscription" && variant) {
        const result =
          paymentMode === "saved" && selectedCardId
            ? await subscriptionApiService.subscribe(variant.id, undefined, {
                savedCardId: selectedCardId,
              })
            : await subscriptionApiService.subscribe(variant.id, card, {
                saveCard,
              });

        if (result.success) {
          showAlert({
            title: "Başarılı",
            description: result.message || "Abonelik başarıyla oluşturuldu!",
          });
          await refresh();
          navigate({ to: "/ayarlar" });
        } else {
          showAlert({
            title: "Hata",
            description: result.error || "Abonelik işlemi başarısız oldu.",
          });
        }
      } else if (type === "credit" && creditPackage) {
        const result =
          paymentMode === "saved" && selectedCardId
            ? await subscriptionApiService.purchaseCredits(
                creditPackage.id,
                undefined,
                { savedCardId: selectedCardId },
              )
            : await subscriptionApiService.purchaseCredits(
                creditPackage.id,
                card,
                { saveCard },
              );

        if (result.success) {
          showAlert({
            title: "Başarılı",
            description:
              result.message ||
              "Kredi satın alma işlemi başarıyla tamamlandı.",
          });
          await refresh();
          navigate({ to: "/ayarlar" });
        } else {
          showAlert({
            title: "Hata",
            description: result.error || "Satın alma işlemi başarısız oldu.",
          });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    const removed = await subscriptionApiService.removeCard(cardId);
    if (removed) {
      const updated = savedCards.filter((c) => c.id !== cardId);
      setSavedCards(updated);
      if (selectedCardId === cardId) {
        if (updated.length > 0) {
          setSelectedCardId(updated[0].id);
        } else {
          setSelectedCardId(null);
          setPaymentMode("new");
        }
      }
    }
  };

  const handleBack = () => {
    navigate({ to: "/subscription" });
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const getAmount = (): number => {
    if (type === "subscription" && variant) return variant.price;
    if (type === "credit" && creditPackage) return Number(creditPackage.price);
    return 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!pharmacy || isPending) {
    return (
      <div className="flex flex-col p-12 space-y-4">
        <p className="text-muted-foreground">
          {isPending
            ? "Eczane kaydınız henüz onaylanmadı. Onay sonrası ödeme yapabilirsiniz."
            : "Eczane kaydı bulunamadı. Lütfen önce eczanenizi kaydedin."}
        </p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri Dön
        </Button>
      </div>
    );
  }

  const notFound =
    (type === "subscription" && !variant) ||
    (type === "credit" && !creditPackage);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <p className="text-muted-foreground">Ürün bulunamadı.</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Ödeme</h1>
          <p className="text-sm text-muted-foreground">
            Ödeme bilgilerinizi girerek işlemi tamamlayın
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {type === "subscription" ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <Coins className="h-5 w-5" />
              )}
              Sipariş Özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === "subscription" && product && variant && (
              <>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">{product.name}</h3>
                  {product.description && (
                    <div
                      className="product-description text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: product.description,
                      }}
                    />
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{variant.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Süre</span>
                    <span className="font-medium">{variant.duration}</span>
                  </div>
                  {variant.includedCreditAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Dahil Kredi
                      </span>
                      <span className="font-medium">
                        Aylık {variant.includedCreditAmount} kredi
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {product.features.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Özellikler:</h4>
                      <ul className="space-y-1.5">
                        {product.features.map((feature, index) => (
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
                  </>
                )}

                <Separator />

                {/* Price */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      Toplam
                    </span>
                    <div className="flex items-baseline gap-2">
                      {variant.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          ₺{variant.originalPrice}
                        </span>
                      )}
                      <span className="text-2xl font-bold">
                        ₺{variant.price}
                      </span>
                    </div>
                  </div>
                  {variant.discount && (
                    <div className="flex justify-end">
                      <Badge variant="secondary" className="text-xs">
                        %{variant.discount} İndirim
                      </Badge>
                    </div>
                  )}
                </div>
              </>
            )}

            {type === "credit" && creditPackage && (
              <>
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Coins className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">
                    {creditPackage.name}
                  </h3>
                  {creditPackage.description && (
                    <p className="text-sm text-muted-foreground">
                      {creditPackage.description}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kredi Miktarı</span>
                    <span className="font-medium">
                      {Number(creditPackage.creditAmount).toFixed(0)} kredi
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Toplam</span>
                  <span className="text-2xl font-bold">
                    ₺{Number(creditPackage.price).toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Card Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Kart Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount badge */}
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Ödenecek Tutar</p>
                <p className="text-2xl font-bold">₺{getAmount().toFixed(2)}</p>
              </div>

              {/* Saved Cards */}
              {savedCards.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Kayıtlı Kartlar</Label>
                  <div className="space-y-2">
                    {savedCards.map((sc) => (
                      <label
                        key={sc.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          paymentMode === "saved" && selectedCardId === sc.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentCard"
                          checked={
                            paymentMode === "saved" && selectedCardId === sc.id
                          }
                          onChange={() => {
                            setPaymentMode("saved");
                            setSelectedCardId(sc.id);
                          }}
                          className="accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {sc.maskedCardNumber}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {sc.cardType}
                            </Badge>
                            {sc.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Varsayılan
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {sc.cardHolderName} - {sc.expireMonth}/{sc.expireYear}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveCard(sc.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </label>
                    ))}

                    {/* New card option */}
                    <label
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        paymentMode === "new"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentCard"
                        checked={paymentMode === "new"}
                        onChange={() => setPaymentMode("new")}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">
                        Yeni kart ile öde
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* New card form */}
              {paymentMode === "new" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Kart Numarası</Label>
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={formatCardNumber(card.cardNumber)}
                      onChange={(e) =>
                        setCard({
                          ...card,
                          cardNumber: e.target.value.replace(/\s/g, ""),
                        })
                      }
                      required
                      maxLength={19}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardHolderName">Kart Sahibi</Label>
                    <Input
                      id="cardHolderName"
                      placeholder="AD SOYAD"
                      value={card.cardHolderName}
                      onChange={(e) =>
                        setCard({
                          ...card,
                          cardHolderName: e.target.value.toUpperCase(),
                        })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="expireMonth">Ay</Label>
                      <Input
                        id="expireMonth"
                        placeholder="MM"
                        value={card.expireMonth}
                        onChange={(e) =>
                          setCard({
                            ...card,
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
                      <Label htmlFor="expireYear">Yıl</Label>
                      <Input
                        id="expireYear"
                        placeholder="YY"
                        value={card.expireYear}
                        onChange={(e) =>
                          setCard({
                            ...card,
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
                      <Label htmlFor="cvc">CVC</Label>
                      <Input
                        id="cvc"
                        placeholder="000"
                        type="password"
                        value={card.cvc}
                        onChange={(e) =>
                          setCard({
                            ...card,
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

                  {/* Save card checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="accent-primary h-4 w-4"
                    />
                    <span className="text-sm">
                      Kartımı sonraki ödemeler için kaydet
                    </span>
                  </label>
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span>
                  Ödeme bilgileriniz güvenli bir şekilde işlenmektedir. Kart
                  bilgileri banka tarafında saklanır.
                </span>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBack}
                  disabled={submitting}
                >
                  İptal
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      İşleniyor...
                    </>
                  ) : type === "subscription" ? (
                    "Abone Ol"
                  ) : (
                    "Satın Al"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/odeme")({
  validateSearch: (search: Record<string, unknown>): OdemeSearch => ({
    type: (search.type as OdemeSearch["type"]) || "subscription",
    id: (search.id as string) || "",
  }),
  component: OdemePage,
});
