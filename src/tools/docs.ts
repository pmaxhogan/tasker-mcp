/**
 * Tasker userguide tools: search_docs, list_docs, get_doc, refresh_docs.
 *
 * The guide is downloaded on first use and cached on disk by ctx.docs
 * (src/docs/store.ts); these tools are thin wrappers over it.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DOC_SECTIONS } from "../docs/index.ts";
import { handler, ok, type ToolContext } from "./context.ts";

const sectionSchema = z
  .enum(DOC_SECTIONS)
  .optional()
  .describe("Restrict to one section: guide, action, event, state, other");

export function register(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "search_docs",
    {
      title: "Search Tasker docs",
      description:
        "Full-text search over the Tasker userguide (guide pages plus the action, event and " +
        "state help pages). Returns slugs with a snippet; read one with get_doc. " +
        'Example: search_docs {"query": "import data", "section": "action"}',
      inputSchema: {
        query: z.string().min(1).describe("Words to search for"),
        section: sectionSchema,
        limit: z.number().int().min(1).max(50).optional().describe("Max hits (default 10)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ query, section, limit }) => {
      const opts: { limit?: number; section?: string } = {};
      if (limit !== undefined) opts.limit = limit;
      if (section !== undefined) opts.section = section;
      const hits = await ctx.docs.search(query, opts);
      return ok({ count: hits.length, hits });
    }),
  );

  server.registerTool(
    "list_docs",
    {
      title: "List Tasker docs",
      description:
        "List the Tasker userguide pages (slug, title, section, word count), optionally for " +
        'one section. Example: list_docs {"section": "event"}',
      inputSchema: { section: sectionSchema },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ section }) => {
      const pages = await ctx.docs.list(section);
      return ok({
        count: pages.length,
        pages: pages.map((p) => ({
          slug: p.slug,
          title: p.title,
          section: p.section,
          words: p.words,
        })),
      });
    }),
  );

  server.registerTool(
    "get_doc",
    {
      title: "Get a Tasker doc page",
      description:
        "Read one Tasker userguide page as Markdown. Accepts a slug (help__ah_import_data), a " +
        "bare help name (ah_import_data) or a page title (Import Data). Links inside a page " +
        "point at slugs that can be passed to get_doc again. " +
        'Example: get_doc {"slug": "ah_import_data"}',
      inputSchema: {
        slug: z.string().min(1).describe("Slug, bare help name (ah_*, eh_*, sh_*) or title"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ slug }) => ok(await ctx.docs.get(slug))),
  );

  server.registerTool(
    "refresh_docs",
    {
      title: "Refresh Tasker docs",
      description:
        "Re-download the userguide index and search data (the cached copy is kept if the " +
        "download fails). Pages already cached on disk are kept as they are. " +
        "Example: refresh_docs {}",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    handler(async () => ok(await ctx.docs.refresh())),
  );
}
