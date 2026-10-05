// TaskerMCP.Dispatch, step 1 (JavaScriptlet).
//
// Authenticates the request, parses the JSON body, and either answers it
// directly (sets status/body/ctype and route = "respond") or sets `route` plus
// arg_* locals for the Tasker actions that follow in the task. Lower-case
// variables declared here with `var` flow back into the task as %name.
//
// Tasker exposes the HTTP Request event's locals as plain JS variables:
// http_request_method, http_request_path, http_request_body, and the array
// http_request_headers ("name:value" strings).

var status = "500";
var ctype = "application/json";
var body = "";
var route = "respond";
var arg_task = "";
var arg_par1 = "";
var arg_par2 = "";
var arg_name = "";
var arg_value = "";
var arg_passthrough = "";
var arg_debug = "0";
var arg_t0 = String(Date.now());

function reply(code, obj) {
  status = String(code);
  body = JSON.stringify(obj);
  route = "respond";
}

function readLocal(fn) {
  try {
    var v = fn();
    if (v === undefined || v === null) return "";
    v = String(v);
    // An unset Tasker variable can surface as its own literal name.
    return /^%[a-z_]+$/.test(v) ? "" : v;
  } catch (_e) {
    return "";
  }
}

function headerList() {
  try {
    return http_request_headers || [];
  } catch (_e) {
    return [];
  }
}

function authorized(token) {
  var hs = headerList();
  for (var i = 0; i < hs.length; i++) {
    var m = /^\s*authorization\s*:\s*bearer\s+(\S+)\s*$/i.exec(String(hs[i]));
    if (m && m[1] === token) return true;
  }
  return false;
}

var GLOBAL_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

function main() {
  var token = readLocal(function () {
    return global("TaskerMCP_Token");
  });
  if (!token)
    return reply(503, { error: "TaskerMCP_Token is not set: run the TaskerMCP.Setup task" });
  if (!authorized(token)) return reply(401, { error: "unauthorized" });

  var method = readLocal(function () {
    return http_request_method;
  }).toUpperCase();
  var path =
    readLocal(function () {
      return http_request_path;
    }).replace(/\/+$/, "") || "/";
  var raw = readLocal(function () {
    return http_request_body;
  });
  var req = {};
  var isXml = path === "/import" || path === "/config";
  if (raw && !isXml) {
    try {
      req = JSON.parse(raw);
    } catch (e) {
      return reply(400, { error: "body is not valid JSON: " + e.message });
    }
    if (req === null || typeof req !== "object") req = {};
  }

  var key = method + " " + path;
  switch (key) {
    case "GET /ping":
      return reply(200, {
        ok: true,
        project: global("TaskerMCP_Version") || "",
        tasker: global("TaskerMCP_TaskerVersion") || "",
        device: global("DEVMOD") || "",
      });
    case "GET /backup":
      route = "backup";
      return;
    case "GET /list":
      route = "list";
      return;
    case "POST /import":
      if (!raw) return reply(400, { error: "empty body: POST the TaskerData XML of one task" });
      route = "import";
      return;
    case "POST /config":
      if (!raw || raw.indexOf("<TaskerData") < 0)
        return reply(400, { error: "body must be a full TaskerData XML configuration" });
      route = "config";
      return;
    case "POST /run":
      if (!req.task) return reply(400, { error: "missing 'task'" });
      arg_task = String(req.task);
      arg_par1 = req.par1 === undefined ? "" : String(req.par1);
      arg_par2 = req.par2 === undefined ? "" : String(req.par2);
      arg_debug = req.debug ? "1" : "0";
      if (req.variables && typeof req.variables === "object") {
        var names = [];
        for (var k in req.variables) {
          if (!/^[a-z][a-z0-9_]*$/.test(k))
            return reply(400, { error: "variable names must be lower case locals: " + k });
          setLocal(k, String(req.variables[k]));
          names.push(k);
        }
        arg_passthrough = names.join(",");
      }
      if (arg_debug === "1") setGlobal("TaskerMCP_Debug", "[]");
      route = "run";
      return;
    case "POST /stop":
      if (!req.task) return reply(400, { error: "missing 'task'" });
      arg_task = String(req.task);
      route = "stop";
      return;
    case "POST /vars/get":
      if (!GLOBAL_NAME.test(String(req.name || "")))
        return reply(400, { error: "invalid variable name" });
      var v = global(String(req.name));
      var isSet = v !== undefined && v !== null && String(v) !== "" && String(v) !== "%" + req.name;
      return reply(
        200,
        isSet ? { name: req.name, value: String(v), set: true } : { name: req.name, set: false },
      );
    case "POST /vars/set":
      if (!GLOBAL_NAME.test(String(req.name || "")) || !/[A-Z]/.test(String(req.name)))
        return reply(400, { error: "global variable names need at least one upper case letter" });
      setGlobal(String(req.name), req.value === undefined ? "" : String(req.value));
      return reply(200, { ok: true });
    case "POST /vars/list":
      route = "varlist";
      return;
    case "POST /profile":
      if (!req.name) return reply(400, { error: "missing 'name'" });
      var done = enableProfile(String(req.name), Boolean(req.enabled));
      return done
        ? reply(200, { ok: true })
        : reply(404, { error: "no profile named " + req.name });
    case "POST /command":
      if (!req.command) return reply(400, { error: "missing 'command'" });
      arg_value = String(req.command);
      route = "command";
      return;
    case "POST /token/rotate":
      route = "rotate";
      return;
    case "GET /runlog":
      route = "runlog";
      return;
    default:
      return reply(404, { error: "no route " + key });
  }
}

try {
  main();
} catch (e) {
  reply(500, { error: "dispatch failed: " + e.message });
}
