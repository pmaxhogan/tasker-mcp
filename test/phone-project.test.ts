import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPhoneProject } from "../scripts/build-phone-project.ts";
import { TaskerDoc } from "../src/model/document.ts";

const committed = readFileSync(new URL("../tasker/TaskerMCP.prj.xml", import.meta.url), "utf8");

describe("phone project", () => {
  it("is up to date with its generator (run node scripts/build-phone-project.ts)", () => {
    expect(buildPhoneProject()).toBe(committed);
  });

  it("parses as a project with the server profile and tasks", () => {
    const doc = TaskerDoc.parse(committed);
    const s = doc.summary();
    expect(s.projects.map((p) => p.name)).toEqual(["TaskerMCP"]);
    expect(s.profiles.map((p) => p.name)).toEqual(["TaskerMCP HTTP"]);
    expect(s.tasks.map((t) => t.name).sort()).toEqual([
      "TaskerMCP.Debug",
      "TaskerMCP.Dispatch",
      "TaskerMCP.Setup",
    ]);
  });
});
