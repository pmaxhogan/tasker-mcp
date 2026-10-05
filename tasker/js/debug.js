// TaskerMCP.Debug: Perform Task this with %par1 = a message to add it to the
// debug channel that run_task returns when called with debug: true.

var items;
try {
  items = JSON.parse(global("TaskerMCP_Debug") || "[]");
} catch (_e) {
  items = [];
}
if (!Array.isArray(items)) items = [];
items.push(String(local("par1")));
if (items.length > 500) items = items.slice(items.length - 500);
setGlobal("TaskerMCP_Debug", JSON.stringify(items));
