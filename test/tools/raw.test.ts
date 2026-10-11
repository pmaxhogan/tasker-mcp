import { afterEach, describe, expect, it } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import { mergeConfig, parseImport, projectXml } from "../../src/tools/raw.ts";
import { register as registerRaw } from "../../src/tools/raw.ts";
import { register as registerStructured } from "../../src/tools/structured.ts";
import { childText } from "../../src/xml/index.ts";
import {
  connectTools,
  createFakeContext,
  EMPTY_BACKUP,
  SCENE_BACKUP,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

let fc: FakeContext | undefined;
let t: ToolHarness | undefined;

async function setup(opts: FakeContextOptions = {}): Promise<{ fc: FakeContext; t: ToolHarness }> {
  fc = await createFakeContext(opts);
  t = await connectTools(fc.ctx, [registerRaw, registerStructured]);
  return { fc, t };
}

afterEach(async () => {
  await t?.close();
  await fc?.cleanup();
  t = undefined;
  fc = undefined;
});

const TASK = (name: string, text: string, id = 7): string =>
  `<Task sr="task${id}"><cdate>1</cdate><edate>1</edate><id>${id}</id><nme>${name}</nme><Action sr="act0" ve="7"><code>548</code><Str sr="arg0" ve="3">${text}</Str><Int sr="arg1" val="0"/></Action></Task>`;

describe("read tools", () => {
  it("returns the backup, truncated when asked", async () => {
    const { fc, t } = await setup();
    const full = await t.call("get_backup_xml");
    expect(full.json).toMatchObject({ truncated: false });
    expect(full.json.xml).toBe(fc.phone.xml());
    const cut = await t.call("get_backup_xml", { maxBytes: 100 });
    expect(cut.json).toMatchObject({ truncated: true });
    expect(Buffer.byteLength(cut.json.xml)).toBeLessThanOrEqual(100);
    expect(cut.json.note).toContain("truncated to 100");
  });

  it("returns one task, profile, project or scene as importable XML", async () => {
    const { t } = await setup({ xml: SCENE_BACKUP });
    const task = await t.call("get_task_xml", { name: "MCP.T1" });
    const td = TaskerDoc.parse(task.json.xml);
    expect(td.tasks().map(TaskerDoc.nameOf)).toEqual(["MCP.T1"]);
    expect((await t.call("get_task_xml", { id: 58 })).json.xml).toContain("TaskerMCP.Dispatch");

    const prof = TaskerDoc.parse(
      (await t.call("get_profile_xml", { name: "TaskerMCP HTTP" })).json.xml,
    );
    expect(prof.profiles()).toHaveLength(1);
    expect(prof.tasks().map(TaskerDoc.nameOf)).toEqual(["TaskerMCP.Dispatch"]);

    const proj = TaskerDoc.parse((await t.call("get_project_xml", { name: "Base" })).json.xml);
    expect(proj.projects().map((p) => childText(p, "name"))).toEqual(["Base"]);
    expect(proj.scenes()).toHaveLength(1);
    expect(proj.tasks().map(TaskerDoc.nameOf)).toEqual(["MCP.T1"]);
    const proj2 = TaskerDoc.parse(
      (await t.call("get_project_xml", { name: "TaskerMCP" })).json.xml,
    );
    expect(proj2.tasks().map(TaskerDoc.nameOf)).toEqual([
      "TaskerMCP.Dispatch",
      "TaskerMCP.Setup",
      "TaskerMCP.Debug",
    ]);

    const scene = TaskerDoc.parse((await t.call("get_scene_xml", { name: "Pop" })).json.xml);
    expect(scene.sceneNames()).toEqual(["Pop"]);
    expect(scene.tasks().map(TaskerDoc.nameOf)).toEqual(["MCP.T1"]);
    expect((await t.call("get_scene_xml", { name: "Nope" })).isError).toBe(true);
  });
});

describe("import_xml", () => {
  it("imports a bare Task through the pipeline", async () => {
    const { fc, t } = await setup();
    const r = await t.call("import_xml", { xml: TASK("Imported", "hi") });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ ok: true, task: "Imported", isNew: true, verified: true });
    expect(fc.phone.routes()).toContain("/import");
    expect(fc.phone.routes()).not.toContain("/config");
  });

  it("replaces an existing task by name, keeping its id", async () => {
    const { fc, t } = await setup();
    const r = await t.call("import_xml", {
      xml: `<TaskerData sr="" dvi="1" tv="6.6.20">${TASK("MCP.T1", "new", 3)}${TASK("Second", "two", 4)}</TaskerData>`,
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.ok).toBe(true);
    expect(r.json.results).toHaveLength(2);
    expect(TaskerDoc.idOf(fc.phone.doc.taskByName("MCP.T1")!)).toBe(45);
    expect(r.json.results[0].changed.join(" ")).toContain("action count");
  });

  it("validates unless told not to", async () => {
    const { t } = await setup();
    const bad = `<Task sr="task1"><id>1</id><nme>B</nme><Action sr="act0" ve="7"><code>38</code></Action></Task>`;
    const r = await t.call("import_xml", { xml: bad });
    expect(r.text).toContain("End If without an open If");
    expect((await t.call("import_xml", { xml: bad, validate: false })).isError).toBe(false);
  });

  it("rejects bad input", async () => {
    const { t } = await setup();
    expect((await t.call("import_xml", { xml: "<oops" })).text).toContain("Invalid XML");
    expect((await t.call("import_xml", { xml: "<Profile/>" })).text).toContain("got <Profile>");
    expect(
      (await t.call("import_xml", { xml: `<TaskerData sr="" dvi="1" tv="1"></TaskerData>` })).text,
    ).toContain("holds no tasks");
    const anon = `<Task sr="task1"><id>1</id></Task>`;
    expect((await t.call("import_xml", { xml: anon })).text).toContain("anonymous task");
  });

  it("merges a project export through a config import", async () => {
    const { fc, t } = await setup();
    const prj = projectXml(TaskerDoc.parse(SCENE_BACKUP), "Base")
      .replace("<name>Base</name>", "<name>Imported</name>")
      .replace("<nme>MCP.T1</nme>", "<nme>Imp.T1</nme>");
    const r = await t.call("import_xml", { xml: prj });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({
      ok: true,
      verified: true,
      imported: { tasks: ["Imp.T1"], projects: ["Imported"], scenes: ["Pop"] },
    });
    const s = fc.phone.doc.summary();
    const proj = s.projects.find((p) => p.name === "Imported");
    expect(proj).toMatchObject({ tasks: ["Imp.T1"], scenes: ["Pop"] });
    // The scene's click task points at the new task id.
    const newId = TaskerDoc.idOf(fc.phone.doc.taskByName("Imp.T1")!);
    expect(fc.phone.xml()).toContain(`<clickTask>${newId}</clickTask>`);
    expect(fc.toolsChangedCount()).toBe(1);
  });

  it("merges a profile export, replacing same-named objects and placing new ones in Base", async () => {
    const { fc, t } = await setup();
    const prof = `<TaskerData sr="" dvi="1" tv="6.6.20">
<Profile sr="prof3" ve="2"><id>3</id><mid0>7</mid0><mid1>99</mid1><nme>TaskerMCP HTTP</nme><Time sr="con0"><fh>1</fh></Time></Profile>
<Profile sr="prof5" ve="2"><id>5</id><mid0>7</mid0><nme>NewProf</nme><Time sr="con0"><fh>1</fh></Time></Profile>
${TASK("MCP.T1", "x", 7)}
</TaskerData>`;
    const r = await t.call("import_xml", { xml: prof });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.warnings.join(" ")).toContain("task id 99");
    const s = fc.phone.doc.summary();
    expect(s.profiles.find((p) => p.name === "TaskerMCP HTTP")).toMatchObject({
      entryTask: "MCP.T1",
      project: "TaskerMCP",
    });
    expect(s.profiles.find((p) => p.name === "NewProf")).toMatchObject({ project: "Base" });
    expect(s.profiles).toHaveLength(2);
  });

  it("refuses structural imports without config import, and checks names", async () => {
    const { t } = await setup({ policy: { allowConfigImport: false } });
    const prj = projectXml(TaskerDoc.parse(SCENE_BACKUP), "Base");
    const r = await t.call("import_xml", { xml: prj });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("whole-configuration import");
    await t.close();
    await fc!.cleanup();
    const s2 = await setup({ policy: { allowPrefixes: ["Ok."], allowConfigImport: true } });
    const denied = await s2.t.call("import_xml", { xml: prj });
    expect(denied.text).toContain("refused");
  });

  it("validates tasks inside a structural import", async () => {
    const { t } = await setup();
    const xml = `<TaskerData sr="" dvi="1" tv="6.6.20"><Project sr="proj0" ve="2"><name>P</name><tids>1</tids></Project><Task sr="task1"><id>1</id><nme>B</nme><Action sr="act0" ve="7"><code>38</code></Action></Task></TaskerData>`;
    expect((await t.call("import_xml", { xml })).text).toContain("End If without an open If");
  });
});

describe("mergeConfig", () => {
  it("warns about project members missing from the import and remaps ids", () => {
    const doc = TaskerDoc.parse(EMPTY_BACKUP);
    const inc = parseImport(
      `<TaskerData sr="" dvi="1" tv="6.6.20"><Project sr="proj0" ve="2"><name>Base</name><pids>8</pids><tids>1,2</tids></Project>${TASK("A", "a", 1)}</TaskerData>`,
    );
    const rep = mergeConfig(doc, inc);
    expect(rep.warnings).toEqual([
      "project Base lists task id 2, which is not in the import",
      "project Base lists profile id 8, which is not in the import",
    ]);
    expect(doc.summary().projects).toEqual([
      { name: "Base", tasks: ["A"], profiles: [], scenes: [] },
    ]);
  });

  it("imports anonymous tasks by fresh id", () => {
    const doc = TaskerDoc.parse(EMPTY_BACKUP);
    const inc = parseImport(
      `<TaskerData sr="" dvi="1" tv="6.6.20"><Task sr="task4"><id>4</id></Task></TaskerData>`,
    );
    expect(mergeConfig(doc, inc).tasks).toEqual(["#1"]);
  });
});
