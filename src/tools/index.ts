/**
 * Every tool module, in registration order. Each module exports
 * `register: RegisterTools`; add a module by appending its import and entry.
 */
import type { RegisterTools } from "./context.ts";
import { register as variables } from "./variables.ts";
import { register as profiles } from "./profiles.ts";
import { register as specs } from "./specs.ts";
import { register as docs } from "./docs.ts";
import { register as logs } from "./logs.ts";
import { register as snapshots } from "./snapshots.ts";
import { register as tasktools } from "./tasktools.ts";
import { register as structured } from "./structured.ts";
import { register as raw } from "./raw.ts";
import { register as run } from "./run.ts";
import { register as persist } from "./persist.ts";

export const TOOL_MODULES: Array<{ name: string; register: RegisterTools }> = [
  { name: "variables", register: variables },
  { name: "profiles", register: profiles },
  { name: "specs", register: specs },
  { name: "docs", register: docs },
  { name: "logs", register: logs },
  { name: "snapshots", register: snapshots },
  { name: "tasktools", register: tasktools },
  { name: "structured", register: structured },
  { name: "raw", register: raw },
  { name: "run", register: run },
  { name: "persist", register: persist },
];
