class WrongIpException extends Error {
  constructor(
    ip: string
  ) {
    const message = `IP bu eczane için giriş yapmaya yetkili değildir. IP Adresi: ${ip}`;
    super(message);
    this.name = "WrongIpException";
  }
}
export {
  WrongIpException
}
