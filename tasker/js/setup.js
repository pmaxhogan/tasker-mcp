// TaskerMCP.Setup, after two Tasker Function GenerateUUID() calls that leave
// their results in %mcp_uuid1 and %mcp_uuid2 (UUID.randomUUID, SecureRandom).
//
// Builds a 64 hex character bearer token and stores it in %TaskerMCP_Token.
// On an emulator only (device model sdk_*), it is also written to shared
// storage so `adb shell cat` can read it; a real phone never writes the token
// to a world-readable file. Any failure lands in %TaskerMCP_SetupError so it
// is visible in the Tasker VARS tab.

var mcp_setup_error = "";
try {
  var mcp_new = (String(local("mcp_uuid1")) + String(local("mcp_uuid2")))
    .replace(/-/g, "")
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(mcp_new)) throw new Error("bad uuid output: " + mcp_new);
  setGlobal("TaskerMCP_Token", mcp_new);
  setGlobal("TaskerMCP_Version", "1");
  var mcp_model = String(global("DEVMOD") || "");
  if (/^sdk_|emulator/i.test(mcp_model)) {
    writeFile("/sdcard/Download/tasker-mcp-token.txt", mcp_new, false);
  }
  setGlobal("TaskerMCP_SetupError", "");
} catch (e) {
  mcp_setup_error = String(e && e.message ? e.message : e);
  setGlobal("TaskerMCP_SetupError", mcp_setup_error);
}
