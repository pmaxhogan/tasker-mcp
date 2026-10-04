/**
 * Block structure of a task's action list, for display depth only. Validation
 * (unbalanced If/End If and so on) lives in src/spec/validate.ts; this module
 * never fails, it just clamps.
 */

/** Block-structure action codes. Else and Else If share 43; Else If carries a ConditionList. */
export const IF = 37;
export const ELSE = 43;
export const END_IF = 38;
export const FOR = 39;
export const END_FOR = 40;

/**
 * Plugin actions are written as code 1000 or as large hashed integers
 * (107361459, 1732635924, ...). Every built-in action code is below 1000.
 * Duplicated from src/spec/table.ts on purpose so the model layer does not
 * depend on the spec index.
 */
export const PLUGIN_CODE_MIN = 1000;

/** Opening a block: the following actions are one level deeper. */
export function opensBlock(code: number): boolean {
  return code === IF || code === FOR;
}

/** Closing a block: this action and the following ones are one level shallower. */
export function closesBlock(code: number): boolean {
  return code === END_IF || code === END_FOR;
}

/**
 * Display depth of each action: If and For indent what follows, End If and
 * End For outdent themselves, Else / Else If sits at its If's level. Unbalanced
 * input never goes below 0.
 */
export function computeDepths(codes: readonly number[]): number[] {
  const out: number[] = [];
  let depth = 0;
  for (const code of codes) {
    if (closesBlock(code)) {
      depth = Math.max(0, depth - 1);
      out.push(depth);
    } else if (code === ELSE) {
      out.push(Math.max(0, depth - 1));
    } else {
      out.push(depth);
      if (opensBlock(code)) depth++;
    }
  }
  return out;
}
