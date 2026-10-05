/**
 * Raw XML tools: read the backup or one object as importable TaskerData XML,
 * and import XML. Tasks are imported one by one through the mutation
 * pipeline; anything holding profiles, projects or scenes is merged into a
 * fresh backup and applied as a whole-configuration import.
 */
import { z } from "zod";
import { BASE_PROJECT, DEFAULT_TV } from "../edit/plan.ts";
import { parseIdList, parseNameList, taskToJson, wrapForImport } from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import {
  child,
  childText,
  cloneNode,
  parseFragment,
  removeChild,
  setAttr,
  setChildText,
  type XmlElement,
} from "../xml/index.ts";
import { handler, ok, ToolError, type RegisterTools, type ToolContext } from "./context.ts";
import {
  applyTask,
  exclusive,
  insertRoot,
  moveToProject,
  parseTaskerXml,
  projectName,
  remapSceneTaskRefs,
  replaceRoot,
  sceneTaskIds,
  specLookup,
  tidy,
  validateOrThrow,
  withConfigEdit,
  type MutationResult,
} from "./mutate.ts";
import { findTask, requireProfile, requireProject, requireScene } from "./structured.ts";

export const DEFAULT_MAX_BYTES = 200_000;

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

function tvOf(doc: TaskerDoc): string {
  return doc.taskerVersion ?? DEFAULT_TV;
}

function uniq(els: Array<XmlElement | undefined>): XmlElement[] {
  const out: XmlElement[] = [];
  for (const e of els) if (e !== undefined && !out.includes(e)) out.push(e);
  return out;
}

function profileTasks(doc: TaskerDoc, profile: XmlElement): Array<XmlElement | undefined> {
  return ["mid0", "mid1"].map((t) => {
    const v = childText(profile, t)?.trim();
    return v !== undefined && /^\d+$/.test(v) ? doc.taskById(Number(v)) : undefined;
  });
}

function sceneTasks(doc: TaskerDoc, scene: XmlElement): Array<XmlElement | undefined> {
  return sceneTaskIds(scene).map((id) => doc.taskById(id));
}

/** A project and everything in it, as a .prj.xml-style TaskerData document. */
export function projectXml(doc: TaskerDoc, name: string): string {
  const p = requireProject(doc, name);
  const profiles = parseIdList(childText(p, "pids")).map((id) => doc.profileById(id));
  const scenes = parseNameList(childText(p, "scenes")).map((n) => doc.sceneByName(n));
  const tasks = parseIdList(childText(p, "tids")).map((id) => doc.taskById(id));
  for (const pr of profiles) if (pr !== undefined) tasks.push(...profileTasks(doc, pr));
  for (const s of scenes) if (s !== undefined) tasks.push(...sceneTasks(doc, s));
  return wrapForImport([p, ...uniq(profiles), ...uniq(scenes), ...uniq(tasks)], tvOf(doc));
}

function utf8Truncate(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  // Drop a partial trailing character.
  return buf.subarray(0, maxBytes).toString("utf8").replace(/�$/, "");
}

// ---------------------------------------------------------------------------
// import_xml
// ---------------------------------------------------------------------------

/** Accepts a TaskerData document or a bare <Task> element. */
export function parseImport(xml: string): TaskerDoc {
  let rootName: string;
  try {
    rootName = parseFragment(xml).name;
  } catch (e) {
    throw new ToolError(
      `Invalid XML: ${(e as Error).message}`,
      "pass TaskerData XML or one <Task>",
    );
  }
  if (rootName === "Task") {
    return parseTaskerXml(
      `<TaskerData sr="" dvi="1" tv="${DEFAULT_TV}">\n\t${xml.trim()}\n</TaskerData>\n`,
    );
  }
  if (rootName !== "TaskerData") {
    throw new ToolError(
      `import_xml takes TaskerData XML or a <Task> element, got <${rootName}>`,
      "export the object from Tasker, or use get_task_xml / get_project_xml",
    );
  }
  return parseTaskerXml(xml);
}

export interface MergeReport {
  tasks: string[];
  profiles: string[];
  projects: string[];
  scenes: string[];
  warnings: string[];
}

/**
 * Merge `inc` into `doc` (a fresh backup), replacing same-named objects and
 * renumbering ids so nothing collides. Mutates `doc`.
 */
export function mergeConfig(doc: TaskerDoc, inc: TaskerDoc): MergeReport {
  const report: MergeReport = { tasks: [], profiles: [], projects: [], scenes: [], warnings: [] };
  let next = doc.nextFreeId();
  const taskIds = new Map<number, number>();
  const profileIds = new Map<number, number>();
  const placed: Array<{ tag: "tids" | "pids" | "scenes"; member: string | number }> = [];

  for (const t of inc.tasks()) {
    const oldId = TaskerDoc.idOf(t);
    const name = TaskerDoc.nameOf(t);
    const existing = name === "" ? undefined : doc.taskByName(name);
    const id = existing === undefined ? next++ : (TaskerDoc.idOf(existing) as number);
    if (oldId !== undefined) taskIds.set(oldId, id);
    const el = cloneNode(t);
    setChildText(el, "id", String(id));
    setAttr(el, "sr", `task${id}`);
    if (existing === undefined) {
      insertRoot(doc, el);
      placed.push({ tag: "tids", member: id });
    } else {
      replaceRoot(doc, existing, el);
    }
    report.tasks.push(name === "" ? `#${id}` : name);
  }

  const mapTask = (v: string | undefined, what: string): string | undefined => {
    if (v === undefined || !/^\d+$/.test(v.trim())) return v;
    const n = Number(v.trim());
    const m = taskIds.get(n);
    if (m !== undefined) return String(m);
    if (doc.taskById(n) === undefined)
      report.warnings.push(
        `${what} refers to task id ${n}, which is not in the import or on the phone`,
      );
    return v;
  };

  for (const p of inc.profiles()) {
    const oldId = TaskerDoc.idOf(p);
    const name = TaskerDoc.nameOf(p);
    const existing = name === "" ? undefined : doc.profileByName(name);
    const id = existing === undefined ? next++ : (TaskerDoc.idOf(existing) as number);
    if (oldId !== undefined) profileIds.set(oldId, id);
    const el = cloneNode(p);
    setChildText(el, "id", String(id));
    setAttr(el, "sr", `prof${id}`);
    for (const tag of ["mid0", "mid1"]) {
      const v = mapTask(childText(el, tag), `profile ${name}`);
      if (v !== undefined) setChildText(el, tag, v);
    }
    if (existing === undefined) {
      insertRoot(doc, el);
      placed.push({ tag: "pids", member: id });
    } else {
      replaceRoot(doc, existing, el);
    }
    report.profiles.push(name === "" ? `#${id}` : name);
  }

  for (const s of inc.scenes()) {
    const name = TaskerDoc.nameOf(s);
    const existing = doc.sceneByName(name);
    const el = cloneNode(s);
    remapSceneTaskRefs(el, taskIds);
    if (existing === undefined) {
      insertRoot(doc, el);
      placed.push({ tag: "scenes", member: name });
    } else {
      replaceRoot(doc, existing, el);
    }
    report.scenes.push(name);
  }

  for (const p of inc.projects()) {
    const name = projectName(p);
    if (doc.projectByName(name) === undefined) {
      const el = cloneNode(p);
      for (const tag of ["tids", "pids", "scenes"]) {
        const c = child(el, tag);
        if (c !== undefined) removeChild(el, c);
      }
      setAttr(el, "sr", `proj${doc.projects().length}`);
      tidy(el);
      insertRoot(doc, el);
    }
    for (const oldId of parseIdList(childText(p, "tids"))) {
      const id = taskIds.get(oldId);
      if (id === undefined)
        report.warnings.push(`project ${name} lists task id ${oldId}, which is not in the import`);
      else moveToProject(doc, "tids", id, name);
    }
    for (const oldId of parseIdList(childText(p, "pids"))) {
      const id = profileIds.get(oldId);
      if (id === undefined)
        report.warnings.push(
          `project ${name} lists profile id ${oldId}, which is not in the import`,
        );
      else moveToProject(doc, "pids", id, name);
    }
    for (const s of parseNameList(childText(p, "scenes"))) moveToProject(doc, "scenes", s, name);
    report.projects.push(name);
  }

  // New objects no imported project claimed go to Base.
  for (const { tag, member } of placed) {
    const inSome = doc.projects().some((p) => {
      const t = childText(p, tag);
      return tag === "scenes"
        ? parseNameList(t).includes(String(member))
        : parseIdList(t).includes(Number(member));
    });
    if (!inSome) moveToProject(doc, tag, member, BASE_PROJECT);
  }
  return report;
}

function assertImportWritable(ctx: ToolContext, inc: TaskerDoc): void {
  for (const t of inc.tasks()) {
    const n = TaskerDoc.nameOf(t);
    if (n !== "") ctx.assertWritable("task", n);
  }
  for (const p of inc.profiles()) {
    const n = TaskerDoc.nameOf(p);
    if (n !== "") ctx.assertWritable("profile", n);
  }
  for (const p of inc.projects()) ctx.assertWritable("project", projectName(p));
  for (const s of inc.scenes()) ctx.assertWritable("scene", TaskerDoc.nameOf(s));
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const register: RegisterTools = (server, ctx) => {
  server.registerTool(
    "get_backup_xml",
    {
      title: "Get backup XML",
      description:
        'The phone\'s full configuration as Tasker Data Backup XML, truncated to maxBytes (default 200000) with a note. Prefer get_task_xml / get_project_xml for one object. Example: get_backup_xml {"maxBytes": 50000}',
      inputSchema: { maxBytes: z.number().int().positive().optional() },
      annotations: READ,
    },
    handler(async ({ maxBytes }: { maxBytes?: number }) => {
      const { xml } = await ctx.backup();
      const limit = maxBytes ?? DEFAULT_MAX_BYTES;
      const bytes = Buffer.byteLength(xml, "utf8");
      if (bytes <= limit) return ok({ bytes, truncated: false, xml });
      return ok({
        bytes,
        truncated: true,
        note: `truncated to ${limit} of ${bytes} bytes; raise maxBytes or read single objects with get_task_xml / get_project_xml`,
        xml: utf8Truncate(xml, limit),
      });
    }),
  );

  server.registerTool(
    "get_task_xml",
    {
      title: "Get task XML",
      description:
        'One task as importable TaskerData XML (by name or id). Example: get_task_xml {"name": "My Task"}',
      inputSchema: { name: z.string().optional(), id: z.number().int().optional() },
      annotations: READ,
    },
    handler(async (args: { name?: string; id?: number }) => {
      const doc = (await ctx.backup()).doc;
      return ok({ xml: wrapForImport([findTask(doc, args)], tvOf(doc)) });
    }),
  );

  server.registerTool(
    "get_profile_xml",
    {
      title: "Get profile XML",
      description:
        'One profile plus its entry and exit tasks as importable TaskerData XML. Example: get_profile_xml {"name": "Battery Low"}',
      inputSchema: { name: z.string() },
      annotations: READ,
    },
    handler(async ({ name }: { name: string }) => {
      const doc = (await ctx.backup()).doc;
      const p = requireProfile(doc, name);
      return ok({ xml: wrapForImport([p, ...uniq(profileTasks(doc, p))], tvOf(doc)) });
    }),
  );

  server.registerTool(
    "get_project_xml",
    {
      title: "Get project XML",
      description:
        'A project with its tasks, profiles and scenes as importable .prj.xml-style TaskerData XML. Example: get_project_xml {"name": "Base"}',
      inputSchema: { name: z.string() },
      annotations: READ,
    },
    handler(async ({ name }: { name: string }) =>
      ok({ xml: projectXml((await ctx.backup()).doc, name) }),
    ),
  );

  server.registerTool(
    "get_scene_xml",
    {
      title: "Get scene XML",
      description:
        'One scene plus the tasks its elements reference as TaskerData XML. Example: get_scene_xml {"name": "Popup"}',
      inputSchema: { name: z.string() },
      annotations: READ,
    },
    handler(async ({ name }: { name: string }) => {
      const doc = (await ctx.backup()).doc;
      const s = requireScene(doc, name);
      return ok({ xml: wrapForImport([s, ...uniq(sceneTasks(doc, s))], tvOf(doc)) });
    }),
  );

  server.registerTool(
    "import_xml",
    {
      title: "Import XML",
      description:
        "Import Tasker XML: a TaskerData document (task, profile, project or scene export) or one bare <Task>. " +
        "Tasks only: each is imported in place by name, validated (unless validate is false), read back and verified. " +
        "Profiles, projects or scenes: merged by name into the current configuration (ids renumbered) and applied as a whole-configuration import. " +
        'Example: import_xml {"xml": "<Task sr=\\"task1\\"><id>1</id><nme>Hi</nme><Action sr=\\"act0\\" ve=\\"7\\"><code>548</code><Str sr=\\"arg0\\" ve=\\"3\\">hi</Str></Action></Task>"}',
      inputSchema: { xml: z.string().min(1), validate: z.boolean().optional() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    handler(async ({ xml, validate }: { xml: string; validate?: boolean }) => {
      const inc = parseImport(xml);
      assertImportWritable(ctx, inc);
      const lookup = specLookup(ctx.spec);
      const structural = inc.profiles().length + inc.projects().length + inc.scenes().length > 0;
      if (structural) {
        if (!ctx.policy.allowConfigImport) {
          throw new ToolError(
            "This XML holds profiles, projects or scenes, which can only be imported with a whole-configuration import, and that is disabled",
            "import tasks alone, or set TASKER_ALLOW_CONFIG_IMPORT=true / --allow-config-import",
          );
        }
        const warnings: string[] = [];
        if (validate !== false) {
          for (const t of inc.tasks())
            warnings.push(...validateOrThrow(ctx.spec, taskToJson(t, lookup)));
        }
        const r = await withConfigEdit(ctx, "import_xml", "import xml", (doc) =>
          mergeConfig(doc, inc),
        );
        ctx.toolsChanged();
        const s = r.doc.summary();
        const missing = [
          ...r.result.tasks.filter((n) => !n.startsWith("#") && !s.tasks.some((t) => t.name === n)),
          ...r.result.profiles.filter(
            (n) => !n.startsWith("#") && !s.profiles.some((p) => p.name === n),
          ),
          ...r.result.projects.filter((n) => !s.projects.some((p) => p.name === n)),
          ...r.result.scenes.filter((n) => !s.scenes.some((x) => x.name === n)),
        ];
        return ok({
          ok: missing.length === 0,
          imported: {
            tasks: r.result.tasks,
            profiles: r.result.profiles,
            projects: r.result.projects,
            scenes: r.result.scenes,
          },
          snapshot: r.snapshot.id,
          changed: [
            `merged ${r.result.tasks.length} tasks, ${r.result.profiles.length} profiles, ${r.result.projects.length} projects, ${r.result.scenes.length} scenes`,
          ],
          warnings: [
            ...warnings,
            ...r.result.warnings,
            ...missing.map((n) => `${n} not found after import`),
          ],
          verified: missing.length === 0,
        });
      }
      const tasks = inc.tasks();
      if (tasks.length === 0)
        throw new ToolError("The XML holds no tasks, profiles, projects or scenes");
      for (const t of tasks) {
        if (TaskerDoc.nameOf(t) === "") {
          throw new ToolError(
            "An anonymous task (no <nme>) cannot be imported on its own: Tasker replaces tasks by name",
            "give it a <nme>, or import it with the profile or scene that uses it",
          );
        }
      }
      return exclusive(async () => {
        const results: MutationResult[] = [];
        for (const t of tasks) {
          results.push(
            await applyTask(ctx, taskToJson(t, lookup), {
              tool: "import_xml",
              element: t,
              ...(validate === undefined ? {} : { validate }),
            }),
          );
        }
        return ok(results.length === 1 ? results[0] : { ok: results.every((r) => r.ok), results });
      });
    }),
  );
};
