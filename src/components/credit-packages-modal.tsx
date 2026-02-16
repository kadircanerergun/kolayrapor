import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreditPackages } from "@/components/credit-packages";

export function CreditPackagesModal() {
  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-2xl">Kredi Satın Al</DialogTitle>
        <DialogDescription>
          Ek kredi satın alarak hizmetlerimizi kullanmaya devam edin
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <CreditPackages />
      </div>
    </DialogContent>
  );
}
