import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SubscriptionProducts } from '@/components/subscription-products';

interface SubscriptionModalProps {
  onClose?: () => void;
}

export function SubscriptionModal({ onClose }: SubscriptionModalProps) {
  return (
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-2xl">Lisans Planları</DialogTitle>
        <DialogDescription>
          İhtiyacınıza uygun planı seçin ve hemen kullanmaya başlayın
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <SubscriptionProducts />
      </div>
    </DialogContent>
  );
}
