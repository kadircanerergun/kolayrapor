import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { subscriptionApiService } from "@/services/subscription-api";
import type { SubscriptionProduct } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

export function SubscriptionProducts() {
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >({});
  const { pharmacy, isPending, currentSubscription } = useSubscription();
  const hasActiveSubscription = currentSubscription?.status === "active";
  const navigate = useNavigate();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await subscriptionApiService.getProducts();
      setProducts(data);

      // Set default variant (popular or first) for each product
      const defaults: Record<string, string> = {};
      data.forEach((product) => {
        const popularVariant = product.variants.find((v) => v.isPopular);
        defaults[product.id] = popularVariant?.id || product.variants[0]?.id;
      });
      setSelectedVariants(defaults);
    } catch {
      toast.error("Abonelik planları yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeClick = (productId: string) => {
    const variantId = selectedVariants[productId];
    if (!variantId) return;

    if (!pharmacy || isPending) {
      toast.info("Satın alabilmek için öncelikle kaydolmalısınız.");
      navigate({ to: "/kayit" });
      return;
    }

    navigate({
      to: "/odeme",
      search: { type: "subscription", id: variantId },
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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const selectedVariantId = selectedVariants[product.id];
        const selectedVariant = product.variants.find(
          (v) => v.id === selectedVariantId,
        );

        return (
          <Card
            key={product.id}
            className={cn(
              "relative flex flex-col",
              product.isRecommended && "border-primary shadow-lg",
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
              <CardTitle className="text-2xl">{product.name}</CardTitle>
              {product.description && (
                <div
                  className="product-description text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col space-y-6">
              {/* Features */}
              {product.features.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Özellikler:</h4>
                  <ul className="space-y-2">
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
              )}

              {/* Variants */}
              {product.variants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Süre Seçin:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() =>
                          setSelectedVariants((prev) => ({
                            ...prev,
                            [product.id]: variant.id,
                          }))
                        }
                        className={cn(
                          "relative rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                          selectedVariantId === variant.id
                            ? "border-primary bg-primary/5"
                            : "border-muted",
                        )}
                      >
                        {variant.isPopular && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <Badge
                              variant="secondary"
                              className="text-xs px-2 py-0"
                            >
                              Popüler
                            </Badge>
                          </div>
                        )}
                        <div className="text-xs font-medium">
                          {variant.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {variant.duration}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price — pushed to bottom with mt-auto */}
              {selectedVariant && (
                <div className="mt-auto space-y-2 pt-4 border-t">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      ₺{selectedVariant.price}
                    </span>
                    {selectedVariant.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through">
                        ₺{selectedVariant.originalPrice}
                      </span>
                    )}
                  </div>
                  {selectedVariant.discount && (
                    <Badge variant="secondary" className="text-xs">
                      %{selectedVariant.discount} İndirim
                    </Badge>
                  )}
                  {selectedVariant.includedCreditAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aylık {selectedVariant.includedCreditAmount} kredi dahil
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selectedVariant.duration} boyunca geçerli
                  </p>
                </div>
              )}
            </CardContent>

            <CardFooter>
              {hasActiveSubscription ? (
                <Button
                  className="w-full"
                  size="lg"
                  variant="outline"
                  disabled
                >
                  Mevcut Aboneliğiniz Aktif
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  variant={product.isRecommended ? "default" : "outline"}
                  onClick={() => handleSubscribeClick(product.id)}
                >
                  Abone Ol
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
