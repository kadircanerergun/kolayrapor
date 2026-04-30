import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CreditPackages } from "@/components/credit-packages";

export function CreditPackagesModal() {
  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogTitle className="sr-only">Ek Kredi Satın Al</DialogTitle>
      <CreditPackages />
    </DialogContent>
  );
}
