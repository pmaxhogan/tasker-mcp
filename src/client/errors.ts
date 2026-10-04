export const HINT_UNAUTHORIZED =
  "token rejected: run the TaskerMCP.Setup task on the phone and set TASKER_TOKEN (or --token-file)";
export const HINT_UNREACHABLE =
  "is the TaskerMCP project imported and its 'TaskerMCP HTTP' profile enabled? " +
  "With adb, `adb forward tcp:1821 tcp:1821`, or set TASKER_URL";
export const HINT_NOT_FOUND =
  "route missing: update the TaskerMCP project on the phone (tasker/TaskerMCP.prj.xml)";

/** Build the user-facing fix hint for a non-2xx status and the phone's error text. */
export function hintForStatus(status: number, detail: string): string {
  if (status === 401) return HINT_UNAUTHORIZED;
  if (status === 404) return HINT_NOT_FOUND;
  if (status >= 500) return `the phone reported an error: ${detail || "(no error text)"}`;
  return detail || `unexpected HTTP status ${status}`;
}

/** The phone answered, but not with a success (or with a body we could not use). */
export class TaskerHttpError extends Error {
  readonly status: number;
  readonly route: string;
  readonly body: string;
  readonly hint: string;

  constructor(opts: { status: number; route: string; body: string; hint: string }) {
    super(`Tasker ${opts.route} failed with HTTP ${opts.status}: ${opts.hint}`);
    this.name = "TaskerHttpError";
    this.status = opts.status;
    this.route = opts.route;
    this.body = opts.body;
    this.hint = opts.hint;
  }
}

/** The phone could not be reached (refused, unknown host, timeout, reset). */
export class TaskerConnectionError extends Error {
  override readonly cause: unknown;
  readonly route: string;
  readonly hint: string;

  constructor(opts: { route: string; cause: unknown; reason: string; hint?: string }) {
    const hint = opts.hint ?? HINT_UNREACHABLE;
    super(`Tasker ${opts.route} unreachable (${opts.reason}): ${hint}`);
    this.name = "TaskerConnectionError";
    this.cause = opts.cause;
    this.route = opts.route;
    this.hint = hint;
  }
}
