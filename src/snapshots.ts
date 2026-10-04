import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
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
    let id = base;
    for (let n = 2; await exists(join(this.dir, `${id}.json`)); n++) {
      id = `${base}~${n}`;
    }
    const info: SnapshotInfo = {
      id,
      label: meta.label,
      createdAt: now.toISOString(),
      bytes: Buffer.byteLength(xml, "utf8"),
    };
    if (meta.tool !== undefined) info.tool = meta.tool;
    if (meta.device !== undefined) info.device = meta.device;
    await writeFile(join(this.dir, `${id}.xml`), xml, "utf8");
    await writeFile(join(this.dir, `${id}.json`), JSON.stringify(info, null, 2), "utf8");
    await this.prune();
    return info;
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
      try {
        const info = JSON.parse(await readFile(join(this.dir, name), "utf8")) as SnapshotInfo;
        if (typeof info.id === "string" && typeof info.createdAt === "string") out.push(info);
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
        return { info: JSON.parse(raw) as SnapshotInfo, xml };
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
