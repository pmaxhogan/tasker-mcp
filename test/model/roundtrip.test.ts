import { describe, expect, it } from "vitest";
import { taskFromJson, taskToJson } from "../../src/model/convert.ts";
import { TaskerDoc } from "../../src/model/document.ts";
import { diffTasks } from "../../src/edit/verify.ts";
import { lookup, loadDoc, taskerFixtures } from "./helpers.ts";

const files = taskerFixtures();
const now = (): number => 1700000000000;

describe("JSON -> XML -> JSON is stable on every fixture task", () => {
  it("finds the real exports", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files)("%s", (rel) => {
    const doc = loadDoc(rel);
    for (const el of doc.tasks()) {
      const id = TaskerDoc.idOf(el) ?? 0;
      const first = taskToJson(el, lookup);
      const strictEl = taskFromJson(first, lookup, { id, fillDefaults: false, base: el, now });
      expect(taskToJson(strictEl, lookup), `task ${id} strict`).toEqual(first);

      const filledEl = taskFromJson(first, lookup, { id, now });
      const filled = taskToJson(filledEl, lookup);
      const d = diffTasks(first, filled, lookup);
      expect(d.differences, `task ${id} with defaults`).toEqual([]);
      expect(d.equal).toBe(true);
    }
  });
});
