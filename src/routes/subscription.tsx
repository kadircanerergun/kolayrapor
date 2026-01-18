import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionProducts } from '@/components/subscription-products';
import { CreditCard } from 'lucide-react';

function SubscriptionPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Abonelik Planları</h1>
        </div>
        <p className="text-muted-foreground">
          İhtiyacınıza uygun planı seçin ve hemen kullanmaya başlayın
        </p>
      </div>

      {/* Products */}
      <SubscriptionProducts />

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">Tüm planlarda:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Otomatik yedekleme</li>
          <li>• SSL güvenlik sertifikası</li>
          <li>• Düzenli güncellemeler</li>
          <li>• İstediğiniz zaman iptal edebilirsiniz</li>
        </ul>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/subscription')({
  component: SubscriptionPage,
});
