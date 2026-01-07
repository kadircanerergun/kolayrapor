export class UnsuccessfulLoginException extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Giriş başarısız - maksimum deneme sayısına ulaşıldı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.",
    );
    this.name = "UnsuccessfulLoginException";
  }
}
