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
import { useDialogContext } from "@/contexts/dialog-context";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Coins,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { calculateKdv, priceWithKdv } from "@/utils/kdv";

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
  const { showAlert } = useDialogContext();

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

  // Success modal
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Error modal
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 3D Secure modal
  const [threeDOpen, setThreeDOpen] = useState(false);
  const [threeDHtml, setThreeDHtml] = useState("");

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
      let result: Awaited<ReturnType<typeof subscriptionApiService.subscribe>>;

      if (type === "subscription" && variant) {
        result =
          paymentMode === "saved" && selectedCardId
            ? await subscriptionApiService.subscribe(variant.id, undefined, {
                savedCardId: selectedCardId,
              })
            : await subscriptionApiService.subscribe(variant.id, card, {
                saveCard,
              });
      } else if (type === "credit" && creditPackage) {
        result =
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
      } else {
        return;
      }

      // 3D Secure — show bank verification page in modal
      if (result.threeDHtml) {
        setThreeDHtml(result.threeDHtml);
        setThreeDOpen(true);
        // Keep submitting=true — will be reset when 3D modal closes
        return;
      }

      if (result.success) {
        await refresh();
        setSuccessMessage(
          result.message ||
            (type === "subscription"
              ? "Lisans başarıyla oluşturuldu!"
              : "Ek kredi satın alma işlemi başarıyla tamamlandı."),
        );
        setSuccessOpen(true);
      } else {
        setErrorMessage(
          result.error ||
            (type === "subscription"
              ? "Lisans işlemi başarısız oldu."
              : "Satın alma işlemi başarısız oldu."),
        );
        setErrorOpen(true);
      }
    } catch {
      setErrorMessage("Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.");
      setErrorOpen(true);
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
    navigate({ to: "/ayarlar", search: { section: "abonelik" } });
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const getBaseAmount = (): number => {
    if (type === "subscription" && variant) return variant.price;
    if (type === "credit" && creditPackage) return Number(creditPackage.price);
    return 0;
  };

  const getAmount = (): number => {
    return priceWithKdv(getBaseAmount());
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
                  {variant.description && (
                    <div
                      className="product-description text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: variant.description,
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

                {/* Price with KDV breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ara Toplam</span>
                    <div className="flex items-baseline gap-2">
                      {variant.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          ₺{variant.originalPrice.toFixed(2)}
                        </span>
                      )}
                      <span className="font-medium">
                        ₺{variant.price.toFixed(2)}
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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">KDV (%20)</span>
                    <span className="font-medium">
                      ₺{calculateKdv(variant.price).toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">Toplam</span>
                    <span className="text-2xl font-bold">
                      ₺{priceWithKdv(variant.price).toFixed(2)}
                    </span>
                  </div>
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
                    <div
                      className="product-description text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: creditPackage.description,
                      }}
                    />
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

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ara Toplam</span>
                    <span className="font-medium">
                      ₺{Number(creditPackage.price).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">KDV (%20)</span>
                    <span className="font-medium">
                      ₺{calculateKdv(Number(creditPackage.price)).toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">Toplam</span>
                    <span className="text-2xl font-bold">
                      ₺{priceWithKdv(Number(creditPackage.price)).toFixed(2)}
                    </span>
                  </div>
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
                    "Lisans Al"
                  ) : (
                    "Satın Al"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 3D Secure Modal */}
      <Dialog open={threeDOpen} onOpenChange={(open) => {
        if (!open) {
          setThreeDOpen(false);
          setThreeDHtml("");
          setSubmitting(false);
        }
      }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden [&>button]:z-10">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              3D Secure Doğrulama
            </DialogTitle>
            <DialogDescription>
              Bankanız tarafından gönderilen SMS kodunu girerek ödemeyi onaylayın.
            </DialogDescription>
          </DialogHeader>
          {threeDHtml && (
            <div className="w-full h-[450px]">
              <webview
                ref={(ref: any) => {
                  if (!ref || ref.__3dListenerAttached) return;
                  ref.__3dListenerAttached = true;

                  ref.addEventListener("did-navigate", (e: any) => {
                    const url = e.url || "";
                    if (url.includes("/store/3d-callback/ok")) {
                      setThreeDOpen(false);
                      setThreeDHtml("");
                      setSubmitting(false);
                      refresh();
                      setSuccessMessage("Ödeme başarıyla tamamlandı!");
                      setSuccessOpen(true);
                    } else if (url.includes("/store/3d-callback/fail")) {
                      setThreeDOpen(false);
                      setThreeDHtml("");
                      setSubmitting(false);
                      let apiMessage: string | null = null;
                      try {
                        const params = new URL(url).searchParams;
                        apiMessage =
                          params.get("message") ||
                          params.get("error") ||
                          params.get("description") ||
                          params.get("reason");
                      } catch {
                        // Malformed URL — fall back to generic message
                      }
                      setErrorMessage(apiMessage || "Kart doğrulama başarısız oldu.");
                      setErrorOpen(true);
                    }
                  });

                  const encoded = encodeURIComponent(threeDHtml);
                  ref.src = `data:text/html;charset=utf-8,${encoded}`;
                }}
                style={{ width: "100%", height: "100%" }}
                // @ts-expect-error webview is an Electron-specific tag
                allowpopups="true"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={successOpen} onOpenChange={(open) => {
        if (!open) {
          setSuccessOpen(false);
          navigate({ to: "/ayarlar", search: { section: "abonelik" } });
        }
      }}>
        <DialogContent hideCloseButton>
          <DialogHeader className="items-center text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center">
              Ödeme Başarılı
            </DialogTitle>
            <DialogDescription className="text-center">
              {successMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => {
              setSuccessOpen(false);
              navigate({ to: "/ayarlar", search: { section: "abonelik" } });
            }}>
              Tamam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={errorOpen} onOpenChange={(open) => {
        if (!open) setErrorOpen(false);
      }}>
        <DialogContent hideCloseButton>
          <DialogHeader className="items-center text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-2">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-center">
              Ödeme Başarısız
            </DialogTitle>
            <DialogDescription className="text-center">
              {errorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setErrorOpen(false)}>
              Tamam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
