export type InventoryErrorCode =
  | "CONFIGURATION"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "INVALID_INPUT";
export class InventoryError extends Error {
  constructor(readonly code: InventoryErrorCode) {
    super("Hotel information is temporarily unavailable.");
    this.name = "InventoryError";
  }
}
