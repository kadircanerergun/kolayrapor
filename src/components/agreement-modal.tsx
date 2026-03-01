import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  subscriptionApiService,
  type PendingAgreement,
} from "@/services/subscription-api";
import { usePharmacy } from "@/contexts/pharmacy-context";

export function AgreementModal() {
  const { pharmacy } = usePharmacy();
  const [pending, setPending] = useState<PendingAgreement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = useCallback(async () => {
    if (!pharmacy || !pharmacy.isActive) return;
    const data = await subscriptionApiService.getPendingAgreements();
    setPending(data);
    setCurrentIndex(0);
    setAccepted(false);
  }, [pharmacy]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const current = pending[currentIndex];
  if (!current) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    const success = await subscriptionApiService.acceptAgreement(current.id);
    setSubmitting(false);

    if (success) {
      setAccepted(false);
      if (currentIndex + 1 < pending.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setPending([]);
      }
    }
  };

  const remaining = pending.length - currentIndex;

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>
            {current.category?.name
              ? `${current.category.name} — Sürüm ${current.version}`
              : `Sürüm ${current.version}`}
            {remaining > 1 && ` (${currentIndex + 1}/${pending.length})`}
          </DialogDescription>
        </DialogHeader>

        <div
          className="max-h-80 overflow-y-auto rounded-md border p-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: current.content }}
        />

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="accept-agreement"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <label
            htmlFor="accept-agreement"
            className="cursor-pointer text-sm font-medium"
          >
            Okudum ve kabul ediyorum
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!accepted || submitting}
          >
            {submitting ? "Kaydediliyor..." : "Kabul Et"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
