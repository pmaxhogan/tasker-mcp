/**
 * Action-spec lookup tools: get_action_spec, search_actions,
 * list_action_categories. All read the bundled table in data/ via ctx.spec;
 * none touch the phone.
 *
 * An unknown numeric code is not an error: Tasker has actions the table does
 * not know (newer versions, plugins), and they can still be used as raw XML.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NamedCode, SpecIndex } from "../spec/table.ts";
import type { ActionSpec } from "../spec/types.ts";
import { fail, handler, ok, type ToolContext } from "./context.ts";

/** MapTasker arg type codes, plus the runtime-only 7 and 8. */
export const ARG_TYPE_NAMES: Record<number, string> = {
  0: "Int",
  1: "String",
  2: "App",
  3: "Boolean",
  4: "Icon",
  5: "Bundle",
  6: "Scene",
  7: "ConditionList",
  8: "Img",
};

export function argTypeName(type: number): string {
  return ARG_TYPE_NAMES[type] ?? `Type ${type}`;
}

export interface ArgView {
  id: number;
  name: string;
  type: string;
  mandatory: boolean;
  spec?: string;
  label?: string;
}

export interface ActionSpecView {
  code: number;
  name: string;
  known: true;
  category?: string;
  canFail?: boolean;
  resName?: string;
  help?: string;
  args: ArgView[];
}

export function specView(index: SpecIndex, spec: ActionSpec): ActionSpecView {
  const view: ActionSpecView = { code: spec.code, name: spec.name, known: true, args: [] };
  const category = index.categoryName(spec.categoryCode);
  if (category !== undefined) view.category = category;
  if (spec.canFail !== undefined) view.canFail = spec.canFail;
  if (spec.resName !== undefined) view.resName = spec.resName;
  if (spec.help !== undefined) view.help = spec.help;
  view.args = [...spec.args]
    .sort((a, b) => a.id - b.id)
    .map((g) => {
      const a: ArgView = {
        id: g.id,
        name: g.name,
        type: argTypeName(g.type),
        mandatory: g.isMandatory,
      };
      if (g.spec !== undefined) a.spec = g.spec;
      if (g.label !== undefined) a.label = g.label;
      return a;
    });
  return view;
}

export interface UnknownCodeView {
  code: number;
  known: false;
  name?: string;
  warning: string;
  suggestions: NamedCode[];
}

/** The non-error answer for a numeric code the table does not have. */
export function unknownCode(index: SpecIndex, code: number): UnknownCodeView {
  const extra = index.extraActionName(code);
  let warning = `Unknown action code ${code}; it can still be used as raw XML (copy it from a Tasker export)`;
  if (index.isPlugin(code)) {
    warning = `Action code ${code} is a plugin action; plugin actions have no spec. It can still be used as raw XML (copy it from a Tasker export)`;
  } else if (extra !== undefined) {
    warning = `Action code ${code} (${extra}) is not in the spec table; it can still be used as raw XML (copy it from a Tasker export)`;
  }
  const view: UnknownCodeView = { code, known: false, warning, suggestions: [] };
  if (extra !== undefined) view.name = extra;
  return view;
}

function snippet(s: string | undefined, max = 140): string | undefined {
  if (s === undefined) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}...` : t;
}

export function register(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_action_spec",
    {
      title: "Get action spec",
      description:
        "Look up a Tasker action by code, name, or an_* resource name: its args (id, name, " +
        "type, mandatory, spec, label), category and help text. Arg ids are the arg<id> " +
        "positions in the XML. An unknown numeric code is not an error: it returns " +
        'known:false with a warning, since raw XML still works. Example: get_action_spec {"codeOrName": "Flash"}',
      inputSchema: {
        codeOrName: z
          .union([z.string(), z.number().int()])
          .describe('Action code (e.g. 548 or "548"), name ("Flash"), or resource name'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler(async ({ codeOrName }) => {
      const raw = String(codeOrName).trim();
      if (/^-?\d+$/.test(raw)) {
        const code = Number(raw);
        const spec = ctx.spec.byCode(code);
        return ok(spec ? specView(ctx.spec, spec) : unknownCode(ctx.spec, code));
      }
      const res = ctx.spec.resolve(raw);
      if ("spec" in res) return ok(specView(ctx.spec, res.spec));
      const close = res.suggestions.map((s) => `${s.name} (${s.code})`).join(", ");
      return fail(
        res.error,
        close ? `did you mean: ${close}? Or use search_actions` : "use search_actions",
      );
    }),
  );

  server.registerTool(
    "search_actions",
    {
      title: "Search actions",
      description:
        "Search the Tasker action table by words in names, arg names/labels, help text and " +
        "category; every word must match somewhere. Optional category (name or code) narrows " +
        'it. Then call get_action_spec for the arg layout. Example: search_actions {"query": "wifi"}',
      inputSchema: {
        query: z.string().describe("Words to search for; empty lists everything"),
        category: z
          .union([z.string(), z.number().int()])
          .optional()
          .describe('Category name or code, e.g. "Net" (see list_action_categories)'),
        limit: z.number().int().min(1).max(200).optional().describe("Max hits (default 20)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler(async ({ query, category, limit }) => {
      const opts: { limit: number; category?: string | number } = { limit: limit ?? 20 };
      if (category !== undefined) opts.category = category;
      const hits = ctx.spec.search(query, opts).map((h) => {
        const out: Record<string, unknown> = { code: h.spec.code, name: h.spec.name };
        if (h.category !== undefined) out.category = h.category;
        out.args = h.spec.args.length;
        const help = snippet(h.spec.help);
        if (help !== undefined) out.help = help;
        return out;
      });
      return ok({ count: hits.length, hits });
    }),
  );

  server.registerTool(
    "list_action_categories",
    {
      title: "List action categories",
      description:
        "List Tasker's action categories with their codes and how many actions each has. Use a " +
        "name or code as search_actions' category. Example: list_action_categories {}",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler(async () => {
      const categories = ctx.spec.categories();
      return ok({ count: categories.length, categories });
    }),
  );
}
