class InvalidLoginException extends Error {
  constructor() {
    super("Kullanıcı adı veya şifre yanlış. Lütfen bilgilerinizi kontrol edin.");
  }
}
export { InvalidLoginException };
