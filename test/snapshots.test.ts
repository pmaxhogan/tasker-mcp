import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SnapshotStore } from "../src/snapshots.ts";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "tasker-mcp-snap-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function clock(startMs = Date.UTC(2026, 9, 4, 23, 15, 0, 123)) {
  let t = startMs;
  return () => new Date(t++);
}

describe("SnapshotStore", () => {
  it("saves xml and metadata with a windows-safe id", async () => {
    const dir = join(root, "nested", "snaps");
    const store = new SnapshotStore(dir, {
      now: () => new Date(Date.UTC(2026, 9, 4, 23, 15, 0, 123)),
    });
    const info = await store.save("<TaskerData/>", {
      label: "Before edit: My Task!",
      tool: "tasker_edit",
      device: "S1",
    });
    expect(info.id).toBe("20261004T231500123Z-before-edit-my-task");
    expect(info).toMatchObject({
      label: "Before edit: My Task!",
      tool: "tasker_edit",
      device: "S1",
      createdAt: "2026-10-04T23:15:00.123Z",
      bytes: 13,
    });
    expect(info.id).toMatch(/^[A-Za-z0-9~-]+$/);
    expect((await readdir(dir)).sort()).toEqual([`${info.id}.json`, `${info.id}.xml`]);
  });

  it("handles empty slugs and counts utf8 bytes", async () => {
    const store = new SnapshotStore(root, { now: clock() });
    const info = await store.save("é", { label: "!!!" });
    expect(info.id).toBe("20261004T231500123Z");
    expect(info.bytes).toBe(2);
    expect(info.tool).toBeUndefined();
  });

  it("disambiguates ids saved in the same millisecond", async () => {
    const fixed = () => new Date(Date.UTC(2026, 9, 4, 1, 2, 3, 4));
    const store = new SnapshotStore(root, { now: fixed });
    const a = await store.save("a", { label: "x" });
    const b = await store.save("b", { label: "x" });
    const c = await store.save("c", { label: "x" });
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    expect((await store.get(b.id)).xml).toBe("b");
    expect((await store.get(c.id)).xml).toBe("c");
  });

  it("gives concurrent saves in the same millisecond distinct ids without overwriting", async () => {
    const fixed = () => new Date(Date.UTC(2026, 9, 4, 1, 2, 3, 4));
    const store = new SnapshotStore(root, { now: fixed });
    const xmls = ["a", "b", "c", "d", "e"];
    const infos = await Promise.all(xmls.map((x) => store.save(x, { label: "x" })));
    expect(new Set(infos.map((i) => i.id)).size).toBe(xmls.length);
    for (let i = 0; i < xmls.length; i++) {
      expect((await store.get(infos[i]!.id)).xml).toBe(xmls[i]);
    }
  });

  it("skips an id whose metadata file already exists and cleans up its own xml", async () => {
    const fixed = () => new Date(Date.UTC(2026, 9, 4, 1, 2, 3, 4));
    const store = new SnapshotStore(root, { now: fixed });
    const base = "20261004T010203004Z-x";
    await writeFile(join(root, `${base}.json`), "{}");
    const info = await store.save("<a/>", { label: "x" });
    expect(info.id).toBe(`${base}~2`);
    expect((await readdir(root)).sort()).toEqual([
      `${base}.json`,
      `${base}~2.json`,
      `${base}~2.xml`,
    ]);
  });

  it("gives up with an error when every suffix is taken", async () => {
    const fixed = () => new Date(Date.UTC(2026, 9, 4, 1, 2, 3, 4));
    const store = new SnapshotStore(root, { now: fixed });
    const base = "20261004T010203004Z-x";
    await writeFile(join(root, `${base}.xml`), "");
    for (let n = 2; n <= 1000; n++) await writeFile(join(root, `${base}~${n}.xml`), "");
    await expect(store.save("<a/>", { label: "x" })).rejects.toThrow(
      /could not find a free snapshot id/,
    );
  });

  it("derives ids from validated filenames and leaves stray files alone", async () => {
    const store = new SnapshotStore(root, { keep: 1, now: clock() });
    const a = await store.save("<a/>", { label: "one" });
    // A stray file whose content claims a path-traversal id: ignored by list and prune.
    const stray = { id: "../../outside", createdAt: "2026-01-01T00:00:00Z", label: "s" };
    await writeFile(join(root, "stray.json"), JSON.stringify(stray));
    // A real-looking file whose content lies about its id: the filename wins.
    const liar = "20261004T231500000Z-liar";
    await writeFile(join(root, `${liar}.json`), JSON.stringify({ ...stray, id: "../x" }));
    await writeFile(join(root, "20261004T231500001Z-null.json"), "null");
    const ids = (await store.list()).map((i) => i.id);
    expect(ids).toEqual([a.id, liar]);
    await store.save("<b/>", { label: "two" });
    const left = (await readdir(root)).sort();
    expect(left).toContain("stray.json");
    expect(left).not.toContain(`${liar}.json`);
    expect(left).not.toContain(`${a.id}.xml`);
  });

  it("lists newest first and round-trips with get", async () => {
    const store = new SnapshotStore(root, { now: clock() });
    const a = await store.save("<a/>", { label: "one" });
    const b = await store.save("<b/>", { label: "two" });
    expect((await store.list()).map((i) => i.id)).toEqual([b.id, a.id]);
    const got = await store.get(a.id);
    expect(got.xml).toBe("<a/>");
    expect(got.info).toEqual(a);
  });

  it("returns an empty list when the dir does not exist yet", async () => {
    expect(await new SnapshotStore(join(root, "missing")).list()).toEqual([]);
  });

  it("rethrows non-ENOENT list errors", async () => {
    const file = join(root, "afile");
    await writeFile(file, "x");
    await expect(new SnapshotStore(file).list()).rejects.toThrow();
  });

  it("ignores foreign and corrupt json files", async () => {
    const store = new SnapshotStore(root, { now: clock() });
    await store.save("<a/>", { label: "ok" });
    await writeFile(join(root, "junk.json"), "{not json");
    await writeFile(join(root, "other.json"), JSON.stringify({ hello: 1 }));
    await writeFile(join(root, "notes.txt"), "hi");
    expect(await store.list()).toHaveLength(1);
  });

  it("prunes to the newest keep (default 20, custom 3)", async () => {
    const def = new SnapshotStore(join(root, "d"), { now: clock() });
    for (let i = 0; i < 22; i++) await def.save(`<${i}/>`, { label: `n${i}` });
    const kept = await def.list();
    expect(kept).toHaveLength(20);
    expect(kept[0]?.label).toBe("n21");
    expect(kept.at(-1)?.label).toBe("n2");
    expect(await readdir(join(root, "d"))).toHaveLength(40);

    const small = new SnapshotStore(join(root, "s"), { keep: 3, now: clock() });
    for (let i = 0; i < 5; i++) await small.save("x", { label: `m${i}` });
    expect((await small.list()).map((i) => i.label)).toEqual(["m4", "m3", "m2"]);
    expect(await small.prune()).toBe(0);
  });

  it("explains a missing id with nearest ids", async () => {
    const store = new SnapshotStore(root, { now: clock() });
    const a = await store.save("<a/>", { label: "alpha" });
    const err = await store.get("20261004T231500999Z-nope").then(
      () => new Error("unexpected"),
      (e: unknown) => e as Error,
    );
    expect(err.message).toContain("not found");
    expect(err.message).toContain(a.id);
    const err2 = await store.get("../../etc/passwd").then(
      () => new Error("unexpected"),
      (e: unknown) => e as Error,
    );
    expect(err2.message).toContain("not found");
  });

  it("explains a missing id when the store is empty", async () => {
    await expect(new SnapshotStore(root).get("x")).rejects.toThrow(/no snapshots yet/);
  });

  it("rethrows non-ENOENT read errors in get", async () => {
    const store = new SnapshotStore(root, { now: clock() });
    const a = await store.save("<a/>", { label: "alpha" });
    // Make the xml path a directory so readFile fails with EISDIR.
    await rm(join(root, `${a.id}.xml`));
    await mkdir(join(root, `${a.id}.xml`));
    await expect(store.get(a.id)).rejects.toThrow();
  });
});
