import { useState, useCallback } from "react";
import { Lightbulb, Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Öneriniz mi var?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Uygulamamızı geliştirmemize yardımcı olun. Önerilerinizi ve geri
              bildirimlerinizi bize iletin.
            </CardDescription>
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
