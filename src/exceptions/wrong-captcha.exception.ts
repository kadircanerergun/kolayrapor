class WrongCaptchaException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'WrongIpException';
  }
}
export { WrongCaptchaException };
