/**
 * Running tasks: run_task (a task that exists), run_actions (an ad-hoc action
 * list), stop_task.
 *
 * run_actions imports the actions as one fixed-name task, TaskerMCP.Scratch,
 * replaced in place on every call under the mutation lock, then runs it. A
 * fresh nonce task per call would need deleting afterwards, and deleting a
 * task needs a whole-configuration import, which restarts Tasker's monitor
 * every time and is disabled on real phones. The write policy must allow the
 * name (on a phone, TASKER_WRITE_ALLOW includes "TaskerMCP.").
 */
import { z } from "zod";
import type { RunResult } from "../client/index.ts";
import type { TaskJson } from "../model/types.ts";
import { handler, ok, ToolError, type RegisterTools, type ToolContext } from "./context.ts";
import {
  actionInputSchema,
  actionsFromInput,
  applyTask,
  exclusive,
  type ActionInput,
} from "./mutate.ts";

export const SCRATCH_TASK = "TaskerMCP.Scratch";

const varName = /^[a-z][a-z0-9_]*$/;

function checkVariables(
  vars: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (vars === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    const name = k.replace(/^%/, "");
    if (!varName.test(name)) {
      throw new ToolError(
        `Variable "${k}" cannot be passed: /run variables become locals of the task, so names must be lower case (letters, digits, _)`,
        "use a lower-case name such as %myvar",
      );
    }
    out[name] = v;
  }
  return out;
}

async function runOnPhone(
  ctx: ToolContext,
  opts: {
    task: string;
    par1?: string;
    par2?: string;
    variables?: Record<string, string>;
    timeoutSec?: number;
    debug?: boolean;
  },
): Promise<RunResult> {
  const client = await ctx.client();
  const req: Parameters<typeof client.run>[0] = { task: opts.task };
  if (opts.par1 !== undefined) req.par1 = opts.par1;
  if (opts.par2 !== undefined) req.par2 = opts.par2;
  const vars = checkVariables(opts.variables);
  if (vars !== undefined) req.variables = vars;
  if (opts.timeoutSec !== undefined) req.timeoutSec = opts.timeoutSec;
  if (opts.debug !== undefined) req.debug = opts.debug;
  return client.run(req);
}

export const register: RegisterTools = (server, ctx) => {
  server.registerTool(
    "run_task",
    {
      title: "Run task",
      description:
        "Run a task on the phone and wait for it: returns {ok, return (its Return value), durationMs, error?, debug?}. par1/par2 become %par1/%par2; variables become locals of the task (lower-case names). debug: true collects TaskerMCP.Debug messages. " +
        'Example: run_task {"name": "My Task", "par1": "hello", "timeoutSec": 30}',
      inputSchema: {
        name: z.string(),
        par1: z.string().optional(),
        par2: z.string().optional(),
        variables: z.record(z.string(), z.string()).optional(),
        timeoutSec: z.number().int().positive().max(3600).optional(),
        debug: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    handler(
      async (args: {
        name: string;
        par1?: string;
        par2?: string;
        variables?: Record<string, string>;
        timeoutSec?: number;
        debug?: boolean;
      }) => {
        const { name, ...rest } = args;
        const r = await runOnPhone(ctx, { task: name, ...rest });
        if (!r.ok && r.error !== undefined && /no task named/i.test(r.error)) {
          throw new ToolError(r.error, "list_tasks shows the task names; names are case sensitive");
        }
        return ok(r);
      },
    ),
  );

  server.registerTool(
    "run_actions",
    {
      title: "Run actions",
      description:
        `Run an ad-hoc list of actions (create_task's action shape) without creating a named task: they are imported as the task ${SCRATCH_TASK} (replaced in place each call), validated, and run. Returns the run result plus {task}. ` +
        "keep: false (default) empties the scratch task again afterwards; true leaves it for get_task. No snapshot is saved for the scratch task. " +
        'Example: run_actions {"actions": [{"action": "Flash", "args": {"Text": "hi"}}, {"action": "Return", "args": {"Value": "done"}}]}',
      inputSchema: {
        actions: z.array(actionInputSchema).min(1),
        timeoutSec: z.number().int().positive().max(3600).optional(),
        debug: z.boolean().optional(),
        keep: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    handler(
      async (args: {
        actions: ActionInput[];
        timeoutSec?: number;
        debug?: boolean;
        keep?: boolean;
      }) => {
        ctx.assertWritable("task", SCRATCH_TASK);
        const task: TaskJson = {
          name: SCRATCH_TASK,
          comment: "Scratch task for tasker-mcp run_actions; replaced on every call.",
          actions: actionsFromInput(ctx.spec, args.actions),
        };
        return exclusive(async () => {
          const applied = await applyTask(ctx, task, {
            tool: "run_actions",
            saveSnapshot: false,
            notify: false,
          });
          const runOpts: Parameters<typeof runOnPhone>[1] = { task: SCRATCH_TASK };
          if (args.timeoutSec !== undefined) runOpts.timeoutSec = args.timeoutSec;
          if (args.debug !== undefined) runOpts.debug = args.debug;
          let result: RunResult;
          try {
            result = await runOnPhone(ctx, runOpts);
          } finally {
            if (args.keep !== true) {
              const empty: TaskJson = {
                name: SCRATCH_TASK,
                comment: task.comment as string,
                actions: [],
              };
              try {
                await applyTask(ctx, empty, {
                  tool: "run_actions",
                  saveSnapshot: false,
                  validate: false,
                  notify: false,
                });
              } catch {
                // Leaving the scratch task populated is harmless; the run result matters more.
              }
            }
          }
          const out: Record<string, unknown> = { ...result, task: SCRATCH_TASK };
          if (applied.warnings.length > 0) out["warnings"] = applied.warnings;
          if (!applied.verified) out["verified"] = false;
          return ok(out);
        });
      },
    ),
  );

  server.registerTool(
    "stop_task",
    {
      title: "Stop task",
      description: 'Stop a running task by name. Example: stop_task {"name": "My Task"}',
      inputSchema: { name: z.string() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handler(async ({ name }: { name: string }) => ok(await (await ctx.client()).stop(name))),
  );
};
