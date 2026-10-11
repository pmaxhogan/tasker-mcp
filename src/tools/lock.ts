/**
 * The process-wide mutation lock. Every mutating tool and persist_config runs
 * under it, so two writes (or a write and a persist) never interleave on the
 * phone. Kept in its own module so src/tools/persist.ts and
 * src/tools/mutate.ts can both use it without an import cycle; mutate.ts
 * re-exports `exclusive`.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const held = new AsyncLocalStorage<true>();
let tail: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` while holding the mutation lock. Nested calls (from inside a
 * locked section) run inline, so composite tools never deadlock.
 */
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (held.getStore() === true) return fn();
  const run = tail.then(() => held.run(true, fn));
  tail = run.catch(() => undefined);
  return run;
}
