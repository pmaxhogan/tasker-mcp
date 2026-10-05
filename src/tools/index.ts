/**
 * Every tool module, in registration order. Each module exports
 * `register: RegisterTools`; add a module by appending its import and entry.
 */
import type { RegisterTools } from "./context.ts";

export const TOOL_MODULES: Array<{ name: string; register: RegisterTools }> = [];
