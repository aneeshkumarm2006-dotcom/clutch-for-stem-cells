/**
 * Typed errors for the analytics hub.
 *
 * Every error carries a machine `code`, an operator-facing `message` that names
 * the fix (the hub's "every error names the fix" rule), and the HTTP status the
 * API should return. The request handler turns these into `{ error }` JSON.
 */
export type HubErrorCode =
  | "secret_missing"
  | "secret_not_base64"
  | "secret_bad_length"
  | "db_unreachable"
  | "not_setup"
  | "already_setup"
  | "unauthorized"
  | "rate_limited"
  | "bad_request"
  | "not_found"
  | "provider_error"
  | "reconnect_needed"
  | "internal";

export class HubError extends Error {
  readonly code: HubErrorCode;
  readonly httpStatus: number;
  readonly detail?: Record<string, unknown>;

  constructor(
    code: HubErrorCode,
    message: string,
    httpStatus = 400,
    detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HubError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.detail = detail;
  }
}

export function isHubError(err: unknown): err is HubError {
  return err instanceof HubError;
}
