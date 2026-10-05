/**
 * TaskerDoc: read-side view over a parsed TaskerData document (Data Backup,
 * project, profile, scene, or task export). Lookups return the live DOM
 * elements; conversion to JSON is in convert.ts.
 *
 * Anonymous tasks and profiles (no `<nme>`) have name "" in every listing and
 * are never matched by name.
 */

import { attr, childText, children, parseXml, serializeXml } from "../xml/index.ts";
import type { XmlDocument, XmlElement } from "../xml/index.ts";
import { parseIdList, parseNameList } from "./convert.ts";

export interface ProjectSummary {
  name: string;
  /** Task names (anonymous tasks by id). */
  tasks: string[];
  /** Profile names (anonymous profiles by id). */
  profiles: string[];
  scenes: string[];
}

export interface TaskSummary {
  id: number;
  name: string;
  project?: string;
}

export interface ProfileSummary {
  id: number;
  name: string;
  project?: string;
  enabled: boolean;
  /** Entry task name, or its id when anonymous. */
  entryTask?: string | number;
  exitTask?: string | number;
}

export interface SceneListing {
  name: string;
  project?: string;
}

export interface DocSummary {
  projects: ProjectSummary[];
  tasks: TaskSummary[];
  profiles: ProfileSummary[];
  scenes: SceneListing[];
}

function intChild(el: XmlElement, name: string): number | undefined {
  const t = childText(el, name)?.trim();
  return t !== undefined && /^-?\d+$/.test(t) ? Number(t) : undefined;
}

export class TaskerDoc {
  readonly doc: XmlDocument;

  constructor(doc: XmlDocument) {
    this.doc = doc;
    if (doc.root.name !== "TaskerData") {
      throw new Error(`not a Tasker file: root element is <${doc.root.name}>, not <TaskerData>`);
    }
  }

  static parse(src: string): TaskerDoc {
    return new TaskerDoc(parseXml(src));
  }

  get root(): XmlElement {
    return this.doc.root;
  }

  /** Tasker version that wrote the file (`tv`), opaque (e.g. "6.6.17-rc"). */
  get taskerVersion(): string | undefined {
    return attr(this.root, "tv");
  }

  serialize(): string {
    return serializeXml(this.doc);
  }

  tasks(): XmlElement[] {
    return children(this.root, "Task");
  }

  profiles(): XmlElement[] {
    return children(this.root, "Profile");
  }

  projects(): XmlElement[] {
    return children(this.root, "Project");
  }

  scenes(): XmlElement[] {
    return children(this.root, "Scene");
  }

  /** `<id>` of a Task or Profile. */
  static idOf(el: XmlElement): number | undefined {
    return intChild(el, "id");
  }

  /** `<nme>` of a Task, Profile, or Scene; "" when anonymous. */
  static nameOf(el: XmlElement): string {
    return childText(el, "nme") ?? "";
  }

  taskById(id: number): XmlElement | undefined {
    return this.tasks().find((t) => TaskerDoc.idOf(t) === id);
  }

  /** First task with this exact name. "" never matches. */
  taskByName(name: string): XmlElement | undefined {
    if (name === "") return undefined;
    return this.tasks().find((t) => TaskerDoc.nameOf(t) === name);
  }

  /** Task name for an id; undefined when unknown, "" when anonymous. */
  taskName(id: number): string | undefined {
    const t = this.taskById(id);
    return t === undefined ? undefined : TaskerDoc.nameOf(t);
  }

  profileById(id: number): XmlElement | undefined {
    return this.profiles().find((p) => TaskerDoc.idOf(p) === id);
  }

  profileByName(name: string): XmlElement | undefined {
    if (name === "") return undefined;
    return this.profiles().find((p) => TaskerDoc.nameOf(p) === name);
  }

  profileName(id: number): string | undefined {
    const p = this.profileById(id);
    return p === undefined ? undefined : TaskerDoc.nameOf(p);
  }

  projectByName(name: string): XmlElement | undefined {
    return this.projects().find((p) => childText(p, "name") === name);
  }

  sceneByName(name: string): XmlElement | undefined {
    return this.scenes().find((s) => TaskerDoc.nameOf(s) === name);
  }

  sceneNames(): string[] {
    return this.scenes().map((s) => TaskerDoc.nameOf(s));
  }

  /** Project whose `<tids>` lists the task id. */
  projectOfTask(id: number): XmlElement | undefined {
    return this.projects().find((p) => parseIdList(childText(p, "tids")).includes(id));
  }

  /** Project whose `<pids>` lists the profile id. */
  projectOfProfile(id: number): XmlElement | undefined {
    return this.projects().find((p) => parseIdList(childText(p, "pids")).includes(id));
  }

  /** Project whose `<scenes>` lists the scene name. */
  projectOfScene(name: string): XmlElement | undefined {
    return this.projects().find((p) => parseNameList(childText(p, "scenes")).includes(name));
  }

  /**
   * Largest task or profile id in the file (0 when none). Tasks and profiles
   * draw from one id counter in Tasker (e.g. rho: profiles 152, 153 and tasks
   * 151, 158 interleave), so both count.
   */
  maxId(): number {
    let max = 0;
    for (const el of [...this.tasks(), ...this.profiles()]) {
      const id = TaskerDoc.idOf(el);
      if (id !== undefined && id > max) max = id;
    }
    return max;
  }

  /** An id no task or profile in this file uses: one above maxId(). */
  nextFreeId(): number {
    return this.maxId() + 1;
  }

  private projectName(el: XmlElement | undefined): string | undefined {
    return el === undefined ? undefined : childText(el, "name");
  }

  /** Listing for the list_* tools. */
  summary(): DocSummary {
    const label = (name: string | undefined, id: number): string =>
      name === undefined || name === "" ? String(id) : name;
    const projects = this.projects().map((p) => ({
      name: childText(p, "name") ?? "",
      tasks: parseIdList(childText(p, "tids")).map((id) => label(this.taskName(id), id)),
      profiles: parseIdList(childText(p, "pids")).map((id) => label(this.profileName(id), id)),
      scenes: parseNameList(childText(p, "scenes")),
    }));

    const tasks: TaskSummary[] = [];
    for (const t of this.tasks()) {
      const id = TaskerDoc.idOf(t);
      if (id === undefined) continue;
      const s: TaskSummary = { id, name: TaskerDoc.nameOf(t) };
      const project = this.projectName(this.projectOfTask(id));
      if (project !== undefined) s.project = project;
      tasks.push(s);
    }

    const ref = (id: number | undefined): string | number | undefined => {
      if (id === undefined) return undefined;
      const n = this.taskName(id);
      return n === undefined || n === "" ? id : n;
    };
    const profiles: ProfileSummary[] = [];
    for (const p of this.profiles()) {
      const id = TaskerDoc.idOf(p);
      if (id === undefined) continue;
      const s: ProfileSummary = {
        id,
        name: TaskerDoc.nameOf(p),
        enabled: childText(p, "limit") !== "true",
      };
      const project = this.projectName(this.projectOfProfile(id));
      if (project !== undefined) s.project = project;
      const entry = ref(intChild(p, "mid0"));
      if (entry !== undefined) s.entryTask = entry;
      const exit = ref(intChild(p, "mid1"));
      if (exit !== undefined) s.exitTask = exit;
      profiles.push(s);
    }

    const scenes: SceneListing[] = this.sceneNames().map((name) => {
      const s: SceneListing = { name };
      const project = this.projectName(this.projectOfScene(name));
      if (project !== undefined) s.project = project;
      return s;
    });

    return { projects, tasks, profiles, scenes };
  }
}
