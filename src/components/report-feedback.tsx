import { useState, useEffect, useCallback } from "react";
import { Star, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import { reportApiService } from "@/services/report-api";

interface ReportFeedbackProps {
  reportId: string;
}

export function ReportFeedback({ reportId }: ReportFeedbackProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [messageSaved, setMessageSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportApiService
      .getFeedback(reportId)
      .then((fb) => {
        if (cancelled) return;
        if (fb) {
          setRating(fb.rating);
          setRatingSaved(true);
          setMessage(fb.message ?? "");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const handleStarClick = useCallback(
    async (star: number) => {
      setRating(star);
      setRatingSaved(false);
      setSavingRating(true);
      try {
        await reportApiService.submitFeedback(
          reportId,
          star,
          message || undefined,
        );
        setRatingSaved(true);
      } catch (e) {
        console.error("Failed to save rating:", e);
      } finally {
        setSavingRating(false);
      }
    },
    [reportId, message],
  );

  const handleSaveMessage = useCallback(async () => {
    if (!rating) return;
    setSavingMessage(true);
    setMessageSaved(false);
    try {
      await reportApiService.submitFeedback(
        reportId,
        rating,
        message || undefined,
      );
      setMessageSaved(true);
    } catch (e) {
      console.error("Failed to save message:", e);
    } finally {
      setSavingMessage(false);
    }
  }, [reportId, rating, message]);

  if (loading) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Geri bildirim yükleniyor...</span>
      </div>
    );
  }

  const displayRating = hoveredStar || rating;

  return (
    <div className="px-3 py-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Bu analizi değerlendirin
      </p>

      {/* Star rating row */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-0.5 transition-transform hover:scale-110"
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => handleStarClick(star)}
            disabled={savingRating}
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                star <= displayRating
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-muted-foreground/40",
              )}
            />
          </button>
        ))}
        {savingRating && (
          <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5 text-muted-foreground" />
        )}
        {!savingRating && ratingSaved && (
          <span className="text-xs text-green-600 ml-1.5">
            Değerlendirmeniz kaydedilmiştir.
          </span>
        )}
      </div>

      {/* Message box + save button — shown after rating is selected */}
      {rating > 0 && (
        <div className="flex gap-2">
          <textarea
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            rows={2}
            placeholder="Mesajınızı yazın (isteğe bağlı)"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setMessageSaved(false);
            }}
            disabled={savingMessage}
          />
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSaveMessage}
              disabled={savingMessage || !message.trim()}
              title="Mesajı Kaydet"
            >
              {savingMessage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
            {messageSaved && (
              <span className="text-[10px] text-green-600 text-center">
                Kaydedildi
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
