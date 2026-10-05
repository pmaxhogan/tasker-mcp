#!/usr/bin/env node
/**
 * Imports a Tasker project file into Tasker on the emulator through the GUI
 * (long-press the project tab > Import Project), the one import path that
 * works before the TaskerMCP HTTP server exists.
 *
 *   node scripts/device/import-project.mjs [tasker/TaskerMCP.prj.xml] [--replace]
 *
 * --replace first deletes an existing project with the same name (and its
 * contents). Tasker must be on its main screen. ANDROID_SERIAL defaults to
 * the emulator.
 */
import { basename } from "node:path";
import { readFileSync } from "node:fs";
import { adb, dismiss, dump, find, longtap, tap, waitFor } from "./ui.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openMain() {
  adb("shell", "am", "start", "-n", "net.dinglisch.android.taskerm/.Tasker");
  await sleep(2500);
  await dismiss();
  await waitFor("text=TASKS", 15);
}

async function projectTab(name) {
  return find(`text=${name}`).find((n) => n.id.endsWith(":id/tab_text"));
}

export async function deleteProject(name) {
  const tab = await projectTab(name);
  if (!tab) return false;
  await longtap(`text=${name}`);
  await tap("text=Delete");
  await sleep(800);
  await tap("text=Delete Contents");
  await sleep(1200);
  await dismiss();
  return true;
}

export async function importProject(file, { replace = false } = {}) {
  const xml = readFileSync(file, "utf8");
  const name = /<Project[^>]*>[\s\S]*?<name>([^<]+)<\/name>/.exec(xml)?.[1];
  if (!name) throw new Error(`${file}: no <Project><name>`);
  const remote = `/sdcard/Tasker/projects/${basename(file)}`;
  adb("shell", "mkdir", "-p", "/sdcard/Tasker/projects");
  adb("push", file, remote);
  await openMain();
  if (await projectTab(name)) {
    if (!replace) throw new Error(`project ${name} already exists; pass --replace`);
    await deleteProject(name);
  }
  // The leftmost project tab is the default project; its icon has a desc.
  const anchor =
    find("desc:Default Project")[0] ?? dump().find((n) => n.id.endsWith(":id/tab_icon"));
  if (!anchor) throw new Error("cannot find the project tab bar");
  adb(
    "shell",
    "input",
    "swipe",
    String(anchor.x),
    String(anchor.y),
    String(anchor.x),
    String(anchor.y),
    "900",
  );
  await sleep(800);
  await tap("text=Import Project");
  await sleep(1500);
  const label = basename(file).replace(/\.prj\.xml$/, "");
  await tap(`text=${label}`);
  await sleep(3000);
  await dismiss();
  if (!(await projectTab(name))) throw new Error(`import of ${name} did not show a project tab`);
  return name;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/device/import-project.mjs")) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--")) ?? "tasker/TaskerMCP.prj.xml";
  importProject(file, { replace: args.includes("--replace") })
    .then((n) => console.log(`imported project ${n}`))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
