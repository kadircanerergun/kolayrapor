import { useState, useCallback } from "react";
import { ArrowRight, Lightbulb, Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  suggestionApiService,
  type CreateSuggestionData,
} from "@/services/suggestion-api";

const CATEGORY_OPTIONS = [
  { value: "feature", label: "Yeni Özellik" },
  { value: "bug", label: "Hata Bildirimi" },
  { value: "improvement", label: "İyileştirme" },
  { value: "other", label: "Diğer" },
] as const;

export function SuggestionCard() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<CreateSuggestionData["category"]>("feature");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const resetForm = useCallback(() => {
    setTitle("");
    setMessage("");
    setCategory("feature");
    setError("");
    setSent(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !message.trim()) {
      setError("Başlık ve mesaj alanlarını doldurun.");
      return;
    }

    setSending(true);
    setError("");
    try {
      await suggestionApiService.create({
        title: title.trim(),
        message: message.trim(),
        category,
      });
      setSent(true);
    } catch (e: any) {
      setError(
        e.response?.data?.message || "Öneri gönderilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSending(false);
    }
  }, [title, message, category]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setOpen(value);
      if (!value) {
        resetForm();
      }
    },
    [resetForm],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {/* Sayfa sonundaki bu kart gözden kaçıyordu: marka rengine çalan bir
            zemin, kenarlık ve sağdaki eylem düğmesi tıklanabilir olduğunu
            açıkça gösteriyor. */}
        <Card className="group relative cursor-pointer overflow-hidden border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent transition-all hover:border-yellow-500/60 hover:shadow-md">
          {/* Sağ üstte yumuşak bir ışıltı — sadece dekoratif. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-yellow-500/10 blur-2xl"
          />
          <CardContent className="flex items-center gap-4 p-4">
            <div className="shrink-0 rounded-xl bg-yellow-500/15 p-2.5 text-yellow-500 ring-1 ring-yellow-500/30 transition-transform group-hover:scale-110">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Öneriniz mi var?</CardTitle>
              <CardDescription className="mt-1">
                Uygulamamızı geliştirmemize yardımcı olun. Önerilerinizi ve geri
                bildirimlerinizi bize iletin.
              </CardDescription>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-yellow-500 text-yellow-950 hover:bg-yellow-400"
            >
              Öneri Gönder
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent>
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                Öneriniz Alındı
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Geri bildiriminiz için teşekkür ederiz. En kısa sürede
                değerlendireceğiz.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Kapat
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Öneri Gönder</DialogTitle>
              <DialogDescription>
                Uygulamamızı geliştirmek için önerilerinizi paylaşın.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="suggestion-category">Kategori</Label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v as CreateSuggestionData["category"])
                  }
                >
                  <SelectTrigger id="suggestion-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggestion-title">Başlık</Label>
                <Input
                  id="suggestion-title"
                  placeholder="Kısa bir başlık yazın"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  disabled={sending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggestion-message">Mesaj</Label>
                <textarea
                  id="suggestion-message"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  rows={4}
                  placeholder="Önerinizi detaylı bir şekilde açıklayın..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  disabled={sending}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/2000
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={sending}
              >
                İptal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={sending || !title.trim() || !message.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Gönderiliyor..." : "Gönder"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
