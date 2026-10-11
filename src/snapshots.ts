import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface SnapshotInfo {
  id: string;
  label: string;
  tool?: string;
  device?: string;
  createdAt: string;
  bytes: number;
}

export interface SnapshotMeta {
  label: string;
  tool?: string;
  device?: string;
}

export interface SnapshotStoreOptions {
  keep?: number;
  now?: () => Date;
}

const ID_RE = /^\d{8}T\d{9}Z(?:-[a-z0-9-]+)?(?:~\d+)?$/;

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:.]/g, "");
}

const MAX_SUFFIX = 1000;

function isEexist(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "EEXIST";
}

export class SnapshotStore {
  readonly dir: string;
  private readonly keep: number;
  private readonly now: () => Date;

  constructor(dir: string, opts?: SnapshotStoreOptions) {
    this.dir = dir;
    this.keep = opts?.keep ?? 20;
    this.now = opts?.now ?? (() => new Date());
  }

  async save(xml: string, meta: SnapshotMeta): Promise<SnapshotInfo> {
    await mkdir(this.dir, { recursive: true });
    const now = this.now();
    const s = slug(meta.label);
    const base = s ? `${stamp(now)}-${s}` : stamp(now);
    // Claim an id with exclusive creates ("wx") so two concurrent saves in the
    // same millisecond never overwrite each other: the loser moves on to ~N.
    for (let n = 1; n <= MAX_SUFFIX; n++) {
      const id = n === 1 ? base : `${base}~${n}`;
      const info: SnapshotInfo = {
        id,
        label: meta.label,
        createdAt: now.toISOString(),
        bytes: Buffer.byteLength(xml, "utf8"),
      };
      if (meta.tool !== undefined) info.tool = meta.tool;
      if (meta.device !== undefined) info.device = meta.device;
      const xmlPath = join(this.dir, `${id}.xml`);
      try {
        await writeFile(xmlPath, xml, { encoding: "utf8", flag: "wx" });
      } catch (err) {
        if (isEexist(err)) continue;
        throw err;
      }
      try {
        await writeFile(join(this.dir, `${id}.json`), JSON.stringify(info, null, 2), {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (err) {
        await rm(xmlPath, { force: true });
        if (isEexist(err)) continue;
        throw err;
      }
      await this.prune();
      return info;
    }
    throw new Error(`could not find a free snapshot id for ${base} in ${this.dir}`);
  }

  async list(): Promise<SnapshotInfo[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const out: SnapshotInfo[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      // The id comes from the filename, never from file content: prune deletes by it.
      const id = name.slice(0, -".json".length);
      if (!ID_RE.test(id)) continue;
      try {
        const info = JSON.parse(await readFile(join(this.dir, name), "utf8")) as SnapshotInfo;
        if (info !== null && typeof info === "object" && typeof info.createdAt === "string") {
          out.push({ ...info, id });
        }
      } catch {
        // Skip unreadable or foreign files.
      }
    }
    // Ids start with the UTC timestamp, so descending id order is newest first.
    out.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return out;
  }

  async get(id: string): Promise<{ info: SnapshotInfo; xml: string }> {
    if (ID_RE.test(id)) {
      try {
        const xml = await readFile(join(this.dir, `${id}.xml`), "utf8");
        const raw = await readFile(join(this.dir, `${id}.json`), "utf8");
        return { info: { ...(JSON.parse(raw) as SnapshotInfo), id }, xml };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }
    const all = (await this.list()).map((i) => i.id);
    const near = all.filter((i) => i.startsWith(id.slice(0, 8)) || i.includes(id)).slice(0, 5);
    const suggestions = (near.length ? near : all.slice(0, 5)).join(", ");
    throw new Error(
      `Snapshot "${id}" not found. ${
        suggestions ? `Nearest ids: ${suggestions}.` : "There are no snapshots yet."
      }`,
    );
  }

  /** Delete all but the newest `keep` snapshots. Returns how many were removed. */
  async prune(): Promise<number> {
    const drop = (await this.list()).slice(this.keep);
    for (const info of drop) {
      await rm(join(this.dir, `${info.id}.xml`), { force: true });
      await rm(join(this.dir, `${info.id}.json`), { force: true });
    }
    return drop.length;
  }
}
