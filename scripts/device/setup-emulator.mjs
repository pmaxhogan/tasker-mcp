#!/usr/bin/env node
/**
 * Brings a fresh emulator to a working tasker-mcp target in one go:
 * installs the Tasker APK, grants what Tasker needs, clicks through first-run
 * onboarding, sets the two preferences the server relies on, imports the
 * TaskerMCP project, runs TaskerMCP.Setup, and saves the token.
 *
 *   node scripts/device/setup-emulator.mjs <Tasker.apk> [--token-out <file>]
 *
 * Start the emulator with snapshots off so this survives a restart:
 *   emulator -avd Pixel_8 -no-window -no-audio -no-boot-anim -no-snapshot
 * (With quick boot, the emulator reloads its old snapshot and silently rolls
 * the disk back, wiping the install.)
 *
 * Safe to run again: it carries on from whatever screen Tasker is showing.
 * SETUP_DEBUG=1 logs each onboarding screen it sees.
 *
 * English UI only. ANDROID_SERIAL defaults to the emulator; never point this
 * at a real phone.
 */
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { adb, dismiss, dump, find, tap, tapXY } from "./ui.mjs";
import { importProject, openMain } from "./import-project.mjs";

const PKG = "net.dinglisch.android.taskerm";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`[setup] ${m}`);
const sh = (...a) => adb("shell", ...a);
const key = (k) => sh("input", "keyevent", `KEYCODE_${k}`);
const has = (q) => find(q).length > 0;

function launch() {
  sh("am", "start", "-n", `${PKG}/.Tasker`);
}

function focus() {
  return /mCurrentFocus=\S+ \S+ ([\w.]+)[/}]/.exec(sh("dumpsys", "window"))?.[1] ?? "";
}

/**
 * First-run onboarding as a loop: look at the screen, take the one step it
 * calls for, look again. No step assumes the one before it, so a run that
 * died half way picks up from wherever Tasker was left.
 */
async function onboarding() {
  launch();
  await sleep(4000);
  let scrolled = 0;
  for (let i = 0; i < 40; i++) {
    const app = focus();
    if (app === "com.android.chrome") {
      // The vendor battery row opens a browser page; ticking it is all we need.
      sh("am", "force-stop", "com.android.chrome");
      launch();
      await sleep(3000);
      continue;
    }
    if (!app) {
      // No focused window: a transition is in flight.
      await sleep(1000);
      continue;
    }
    const nodes = dump();
    if (process.env.SETUP_DEBUG)
      log(
        `${app}: ${nodes
          .map((n) => n.text)
          .filter(Boolean)
          .join(" | ")
          .slice(0, 300)}`,
      );
    const on = (q) => find(q, nodes)[0];
    const hit = async (n, ms = 1500) => {
      tapXY(n.x, n.y);
      await sleep(ms);
    };
    if (on("text=TASKS") && on("desc:More options")) return log("onboarding done");
    if (app === "com.android.settings") {
      // Notification settings opened by the helper-notification row.
      const sw = on("text=Show notifications");
      const state = nodes.find((n) => n.cls === "Switch");
      if (sw && (!state || state.checked)) await hit(sw, 1000);
      key("BACK");
      await sleep(2500);
      continue;
    }
    if (app && app !== PKG && app !== "android") {
      launch();
      await sleep(3000);
      continue;
    }
    const button = [
      "text=Don't Show Again",
      "text=STOP REMINDING",
      on("text=Disclaimer") ? "text=Accept" : "",
      "text=Proceed",
    ]
      .filter(Boolean)
      .map(on)
      .find(Boolean);
    if (button) {
      await hit(button, 2500);
      continue;
    }
    if (on("text=Make Your Choice")) {
      await hit(on("desc:Tasker"), 2500);
      continue;
    }
    if (on("text=Check all checkboxes to proceed")) {
      const box = nodes.find((n) => n.cls === "CheckBox" && !n.checked);
      if (box) {
        await hit(box, 2500);
      } else {
        // Remaining rows are below (or, after a few tries, above) the fold.
        const [from, to] = scrolled++ % 4 < 2 ? ["1800", "600"] : ["600", "1800"];
        sh("input", "swipe", "540", from, "540", to, "300");
        await sleep(1000);
      }
      continue;
    }
    const ok = on("text=OK") ?? on("text=Ok") ?? on("text=Got it") ?? on("text=Dismiss");
    if (ok) {
      await hit(ok);
      continue;
    }
    // Nothing recognisable, typically the blank transparent activity Tasker
    // leaves in front after coming back from Settings: bring the UI back.
    launch();
    await sleep(3000);
  }
  throw new Error("onboarding did not reach the Tasker main screen");
}

async function setCheckbox(idSuffix, want) {
  const box = find(`id:${idSuffix}`)[0];
  if (!box) throw new Error(`preference ${idSuffix} not on screen`);
  if (box.checked !== want) {
    tapXY(box.x, box.y);
    await sleep(900);
    await dismiss();
  }
}

async function preferences() {
  await openMain();
  await tap("desc:More options");
  await tap("text=Preferences");
  await sleep(2000);
  await dismiss();
  await tap("text=UI");
  await setCheckbox("tips_checkbox", false);
  await tap("text=MISC");
  await sleep(800);
  await setCheckbox("allow_ext_checkbox", true);
  sh("input", "swipe", "540", "2000", "540", "700", "300");
  await sleep(1000);
  await setCheckbox("extra_logging_checkbox", true);
  await setCheckbox("settings_ask_for_permission_on_app_exit_checkbox", false);
  key("BACK");
  await sleep(2500);
  await openMain();
  log("preferences set: Allow External Access on, Debug To System Log on");
}

async function main() {
  const args = process.argv.slice(2);
  const apk = args.find((a) => !a.startsWith("--"));
  const outIdx = args.indexOf("--token-out");
  const tokenOut =
    outIdx >= 0 ? args[outIdx + 1] : join(homedir(), ".tasker-mcp", "emulator-token");
  if (!apk) throw new Error("usage: setup-emulator.mjs <Tasker.apk> [--token-out <file>]");

  if (!sh("pm", "list", "packages").includes(PKG)) {
    log("installing Tasker");
    adb("install", "-r", "-g", apk);
  }
  sh("appops", "set", PKG, "MANAGE_EXTERNAL_STORAGE", "allow");
  sh("appops", "set", PKG, "SYSTEM_ALERT_WINDOW", "allow");
  sh("appops", "set", PKG, "WRITE_SETTINGS", "allow");
  sh("pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS");
  sh("dumpsys", "deviceidle", "whitelist", `+${PKG}`);
  for (const s of [
    "window_animation_scale",
    "transition_animation_scale",
    "animator_duration_scale",
  ]) {
    sh("settings", "put", "global", s, "0");
  }

  await onboarding();
  await preferences();

  const name = await importProject("tasker/TaskerMCP.prj.xml", { replace: true });
  if (has("desc:Apply")) await tap("desc:Apply");
  // Leaving the editor saves the import to disk.
  key("BACK");
  await sleep(3000);
  log(`imported project ${name}`);

  // Remove the old file so a stale token is never mistaken for a new one.
  const tokenFile = "/sdcard/Download/tasker-mcp-token.txt";
  sh("rm", "-f", tokenFile);
  sh(
    "am",
    "broadcast",
    "-a",
    "net.dinglisch.android.tasker.ACTION_TASK",
    "--es",
    "version_number",
    "1.1",
    "--es",
    "task_name",
    "TaskerMCP.Setup",
    "--ei",
    "task_priority",
    "5",
  );
  let token = "";
  for (let i = 0; i < 30 && !/^[0-9a-f]{64}$/.test(token); i++) {
    await sleep(1000);
    token = sh(`cat ${tokenFile} 2>/dev/null || true`).trim();
  }
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("TaskerMCP.Setup did not write a token");
  // Owner-only: the token is full control of Tasker.
  mkdirSync(dirname(tokenOut), { recursive: true, mode: 0o700 });
  writeFileSync(tokenOut, token, { mode: 0o600 });
  chmodSync(tokenOut, 0o600);
  adb("forward", "tcp:1821", "tcp:1821");
  log(`token saved to ${tokenOut}; adb forward tcp:1821 is up`);
}

main().catch((e) => {
  console.error(`[setup] failed: ${e.message}`);
  process.exit(1);
});
