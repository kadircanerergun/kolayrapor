enum PlaywrightErrorCode {
  TIMEOUT = "TIMEOUT",
  NETWORK = "NETWORK",
  ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND",
  UNKNOWN = "UNKNOWN",
  NOT_INITIALIZED = "NOT_INITIALIZED",
}
class PlaywrightException extends Error {
  code: PlaywrightErrorCode;
  constructor(code: PlaywrightErrorCode = PlaywrightErrorCode.UNKNOWN) {
    super(`Playwright Exception with code: ${code}`);
    this.name = "PlaywrightException";
    this.code = code;
  }
  getErrorCode() {
    return this.code;
  }
}

export {
  PlaywrightException,
  PlaywrightErrorCode
}
