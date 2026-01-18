import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SubscriptionProducts } from '@/components/subscription-products';

interface SubscriptionModalProps {
  onClose?: () => void;
}

export function SubscriptionModal({ onClose }: SubscriptionModalProps) {
  return (
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-2xl">Abonelik Planları</DialogTitle>
        <DialogDescription>
          İhtiyacınıza uygun planı seçin ve hemen kullanmaya başlayın
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <SubscriptionProducts />
      </div>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2 text-sm">Tüm planlarda:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Otomatik yedekleme</li>
          <li>• SSL güvenlik sertifikası</li>
          <li>• Düzenli güncellemeler</li>
          <li>• İstediğiniz zaman iptal edebilirsiniz</li>
        </ul>
      </div>
    </DialogContent>
  );
}
