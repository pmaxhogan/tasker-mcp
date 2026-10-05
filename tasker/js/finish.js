// TaskerMCP.Dispatch, last JavaScriptlet before the HTTP Response.
//
// Builds the response body for routes that ran Tasker actions after the
// dispatcher (backup, list, import, run, ...). Routes the dispatcher answered
// itself arrive here with route = "respond" and are left alone.
//
// Errors from actions that run with "Continue Task After Error" surface as the
// locals %err / %errmsg.
//
// Locals set by an earlier JavaScriptlet are NOT visible here as plain JS
// variables (observed on Tasker 6.6.20), so every input is read with local()
// and the outputs are declared with var so Tasker copies them back.

var route = String(local("route") || "");
var status = String(local("status") || "500");
var ctype = String(local("ctype") || "application/json");
var body = String(local("body") || "");

function readLocal(fn) {
  try {
    var v = typeof fn === "string" ? local(fn) : fn();
    if (v === undefined || v === null) return "";
    v = String(v);
    return /^%[a-z_0-9]+$/.test(v) ? "" : v;
  } catch (_e) {
    return "";
  }
}

function list(name) {
  var v;
  try {
    // Local Tasker arrays are injected as JS arrays (this worked for the
    // Test Tasker results); fall back to local("x") and then x1..xN.
    try {
      v = eval(name);
    } catch (_e) {
      v = local(name);
    }
    if (v !== undefined && v !== null && typeof v === "object" && v.length !== undefined) {
      var arr = [];
      for (var j = 0; j < v.length; j++) arr.push(String(v[j]));
      return arr;
    }
    if (v === undefined || v === null || v === "" || /^%[a-z_0-9]+$/.test(String(v))) {
      var items = [];
      for (var i = 1; i < 100000; i++) {
        var item = local(name + i);
        if (item === undefined || item === null || item === "" || /^%/.test(String(item))) break;
        items.push(String(item));
      }
      return items;
    }
  } catch (_e) {
    return [];
  }
  if (v === undefined || v === null) return [];
  if (typeof v === "string") {
    if (/^%[a-z_0-9]+$/.test(v) || v === "") return [];
    return v.split(",");
  }
  var out = [];
  for (var k = 0; k < v.length; k++) out.push(String(v[k]));
  return out;
}

function respond(code, obj) {
  status = String(code);
  body = typeof obj === "string" ? obj : JSON.stringify(obj);
  route = "respond";
}

function failed() {
  return readLocal("err") !== "";
}

function failure() {
  return readLocal("errmsg") || "action failed (err " + readLocal("err") + ")";
}

function finish() {
  switch (route) {
    case "backup":
      if (failed()) return respond(500, { error: "Data Backup failed: " + failure() });
      var xml = readFile("/sdcard/Tasker/tasker-mcp/backup.xml");
      if (!xml) return respond(500, { error: "backup file was empty" });
      ctype = "text/xml";
      return respond(200, xml);
    case "list":
      return respond(200, {
        projects: list("mcp_projects"),
        profiles: list("mcp_profiles"),
        tasks: list("mcp_tasks"),
        scenes: list("mcp_scenes"),
        globals: list("mcp_globals"),
      });
    case "varlist":
      return respond(200, {
        globals: list("mcp_globals"),
      });
    case "import":
      if (failed()) return respond(500, { error: "Import Data failed: " + failure() });
      return respond(200, { ok: true });
    case "run": {
      var known = list("mcp_tasks");
      var wanted = String(local("arg_task"));
      if (known.length && known.indexOf(wanted) < 0)
        return respond(200, {
          ok: false,
          durationMs: 0,
          error: "no task named " + wanted + "; use list_tasks",
        });
      var out = { ok: !failed(), durationMs: Date.now() - Number(local("arg_t0")) };
      var ret = readLocal("mcp_result");
      if (ret !== "") out["return"] = ret;
      if (failed()) out.error = failure();
      if (local("arg_debug") === "1") {
        try {
          out.debug = JSON.parse(global("TaskerMCP_Debug") || "[]");
        } catch (_e) {
          out.debug = [];
        }
      }
      return respond(200, out);
    }
    case "stop":
    case "command":
      if (failed()) return respond(500, { error: failure() });
      return respond(200, { ok: true });
    case "rotate": {
      var t = global("TaskerMCP_Token");
      if (!t) return respond(500, { error: "token rotation failed" });
      return respond(200, { token: t });
    }
    case "runlog": {
      // Tasker has no action that exports the Run Log, and readFile() on a
      // missing file aborts the script, so this route only reports that.
      return respond(501, {
        error: "Tasker has no Run Log export action; use get_logcat (Debug To System Log) instead",
      });
    }
    default:
      return undefined;
  }
}

try {
  finish();
} catch (e) {
  respond(500, { error: "finish failed: " + e.message });
}
