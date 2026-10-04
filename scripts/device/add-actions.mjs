#!/usr/bin/env node
/**
 * Adds actions to the task currently open in Tasker's Task Edit screen, each
 * with its default arguments, by searching the action picker. Used to harvest
 * ground-truth XML for action arg layouts: build a task this way, run a Data
 * Backup, and copy the exported <Action> elements.
 *
 *   node scripts/device/add-actions.mjs "Read File" "Write File" "Test Tasker"
 *
 * Each name is typed into the picker filter; the entry whose text equals the
 * name exactly is tapped, then the action editor is closed with its up arrow
 * (which saves it). ANDROID_SERIAL defaults to the emulator.
 */
import { adb, dismiss, dump, find, tap, tapXY, typeText, waitFor } from "./ui.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clearField() {
  adb("shell", "input", "keyevent", "KEYCODE_MOVE_END");
  adb("shell", "for i in $(seq 1 40); do input keyevent 67; done");
}

export async function closeActionEditor() {
  await waitFor("text=Action Edit", 10);
  for (let attempt = 0; attempt < 3; attempt++) {
    await tap("desc:Navigate up");
    await sleep(1200);
    if (!find("text=Action Edit")[0]) return;
    // Still open: a mandatory field is empty. Fill empty text fields with a
    // placeholder variable and try again.
    const empties = dump().filter((n) => n.cls === "EditText" && (n.text === "" || n.text === "%"));
    for (const e of empties) {
      tapXY(e.x, e.y);
      await sleep(400);
      typeText(e.text === "%" ? "gtvar" : "%gtvar");
    }
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await sleep(600);
  }
  throw new Error("action editor would not close");
}

export async function addAction(name) {
  await tap("id:button_add_action");
  await dismiss();
  await waitFor("id:filter_text", 10);
  await tap("id:filter_text");
  await sleep(800);
  await clearField();
  typeText(name);
  await sleep(1500);
  const exact = find(`text=${name}`).filter((n) => n.id.endsWith(":id/text"));
  const hit = exact[0];
  if (!hit) {
    const seen = dump()
      .filter((n) => n.id.endsWith(":id/text"))
      .map((n) => n.text);
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await sleep(500);
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await sleep(800);
    throw new Error(`action "${name}" not found in picker; saw: ${seen.join(", ")}`);
  }
  tapXY(hit.x, hit.y);
  await sleep(1800);
  await dismiss();
  // Close the action editor with its up arrow, which saves it (BACK may only
  // dismiss the keyboard).
  await closeActionEditor();
  await dismiss();
}

async function main() {
  const names = process.argv.slice(2);
  const failed = [];
  for (const name of names) {
    try {
      await addAction(name);
      console.log(`added: ${name}`);
    } catch (e) {
      console.log(`FAILED: ${name}: ${e.message}`);
      failed.push(name);
    }
  }
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/device/add-actions.mjs")) {
  await main();
}
