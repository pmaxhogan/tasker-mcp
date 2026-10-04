import { describe, expect, it } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import { loadDoc, readFixture } from "./helpers.ts";

describe("TaskerDoc", () => {
  const rho = loadDoc("public/rho.prj.xml");

  it("rejects a non-Tasker root", () => {
    expect(() => TaskerDoc.parse("<foo/>")).toThrow(/TaskerData/);
  });

  it("serializes losslessly and exposes tv", () => {
    expect(rho.serialize()).toBe(readFixture("public/rho.prj.xml"));
    expect(rho.taskerVersion).toBe("6.6.17-rc");
  });

  it("lists and finds objects", () => {
    expect(rho.tasks()).toHaveLength(11);
    expect(rho.profiles()).toHaveLength(11);
    expect(rho.projects()).toHaveLength(1);
    expect(rho.scenes()).toHaveLength(0);
    const t = rho.taskByName("RhoOpenUrl")!;
    expect(TaskerDoc.idOf(t)).toBe(151);
    expect(rho.taskById(151)).toBe(t);
    expect(rho.taskById(1)).toBeUndefined();
    expect(rho.taskByName("")).toBeUndefined();
    expect(rho.taskName(151)).toBe("RhoOpenUrl");
    expect(rho.taskName(1)).toBeUndefined();
    expect(TaskerDoc.idOf(rho.profileByName("Launch App")!)).toBe(160);
    expect(rho.profileByName("")).toBeUndefined();
    expect(rho.profileName(152)).toBe("");
    expect(rho.profileName(1)).toBeUndefined();
    expect(rho.projectByName("Rho")).toBeDefined();
    expect(rho.projectOfTask(151)).toBe(rho.projectByName("Rho"));
    expect(rho.projectOfTask(99999)).toBeUndefined();
    expect(rho.projectOfProfile(160)).toBe(rho.projectByName("Rho"));
  });

  it("ids: tasks and profiles share one counter", () => {
    expect(rho.maxId()).toBe(181);
    expect(rho.nextFreeId()).toBe(182);
    expect(TaskerDoc.parse('<TaskerData sr="" dvi="1" tv="1"/>').nextFreeId()).toBe(1);
  });

  it("scenes and their project", () => {
    const d = loadDoc("public/ktools-alarm.prj.xml");
    const names = d.sceneNames();
    expect(names.length).toBeGreaterThan(0);
    expect(d.sceneByName(names[0]!)).toBeDefined();
    const s = d.summary();
    expect(s.scenes[0]).toEqual({ name: names[0], project: d.summary().projects[0]?.name });
    expect(s.projects[0]?.scenes).toEqual(names);
  });

  it("summary for list tools", () => {
    const s = rho.summary();
    expect(s.projects).toHaveLength(1);
    expect(s.projects[0]?.name).toBe("Rho");
    expect(s.projects[0]?.tasks).toContain("RhoOpenUrl");
    expect(s.projects[0]?.profiles).toContain("Launch App");
    expect(s.projects[0]?.profiles).toContain("152");
    expect(s.tasks).toContainEqual({ id: 151, name: "RhoOpenUrl", project: "Rho" });
    expect(s.profiles).toContainEqual({
      id: 160,
      name: "Launch App",
      project: "Rho",
      enabled: true,
      entryTask: "RhoLaunchApp",
    });
    expect(s.scenes).toEqual([]);
  });

  it("summary: disabled profile, exit task, anonymous entry task, no project", () => {
    const d = TaskerDoc.parse(
      [
        '<TaskerData sr="" dvi="1" tv="6.0">',
        '<Profile sr="prof1" ve="2"><id>1</id><limit>true</limit><mid0>2</mid0><mid1>3</mid1><nme>P</nme></Profile>',
        '<Profile sr="prof9" ve="2"><nme>no id</nme></Profile>',
        '<Task sr="task2"><id>2</id></Task>',
        '<Task sr="task3"><id>3</id><nme>Exit</nme></Task>',
        '<Task sr="taskx"><nme>no id</nme></Task>',
        "</TaskerData>",
      ].join(""),
    );
    const s = d.summary();
    expect(s.profiles).toEqual([
      { id: 1, name: "P", enabled: false, entryTask: 2, exitTask: "Exit" },
    ]);
    expect(s.tasks).toEqual([
      { id: 2, name: "" },
      { id: 3, name: "Exit" },
    ]);
    expect(s.projects).toEqual([]);
  });
});
