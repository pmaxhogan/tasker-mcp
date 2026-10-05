# Java Code

Source: https://tasker.joaoapps.com/userguide/en/help/ah_java_code.html

☰ Java Code

#### Java Code

Allows you to write and execute arbitrary **Java code**. The code is interpreted by the **[BeanShell](https://beanshell.org/manual/bshmanual.html)** interpreter, which uses a syntax similar to older versions of Java (pre-Java 5).

AI Code Helper

Click the **magnifying glass icon** next to the code field to get help writing your code. You can use the built-in AI to generate the code for you directly in the editor, or you can copy the system instructions to use with your preferred external AI (like ChatGPT, Gemini, etc.).

Available Variables

Two special variables are always available for you to use in your code: `context` and `tasker`.

The `context` variable is an Android **Context** object from a Service. Because it is not from an Activity, you **must** add the flag `FLAG_ACTIVITY_NEW_TASK` when starting new activities to avoid errors.

The `tasker` variable is a helper object that provides methods to interact with Tasker and the system. The available methods are:

- `String getVariable(String name)`
  Reads a Tasker variable. The name must not include the '%' prefix. Returns `null` if the variable is not set.
  *Example:* `String data = tasker.getVariable("http_data");`
- `void setVariable(String name, Object value)`
  Sets a standard Tasker variable. The name must not include the '%' prefix. The value will be converted to a string. The scope (local/global) depends on the capitalization of the name. There is also a 3-argument override `setVariable(String name, Object value, boolean structureVariable)`: pass `true` when the value is structured data (JSON, HTML, XML or CSV) so Tasker parses it and you can read inner fields in later actions (e.g. `%myvar.field`).
  *Example:* `tasker.setVariable("LastLocation", "Home");`
- `void setJavaVariable(String name, Object value)`
  Sets a Java object variable that can be accessed by other Java actions. This is for passing complex data. The scope (local/global) depends on the capitalization of the name.
  *Example:* `tasker.setJavaVariable("myList", new ArrayList());`
- `Object getJavaVariable(String name)`
  Retrieves a Tasker Java Variable that was set in a previous action. Note that Java variables are automatically available by name at the start of the script, so you rarely need to call this explicitly unless you need to re-fetch a value during execution.

##### Critical: Checking for `null` vs `void`

  In BeanShell, a variable that has not been set (e.g., an injected Java variable from a previous action that didn't run) is not `null`. It is a special value: `void`. If you only check `myVar == null`, your script will crash with an 'Undefined variable' error if `myVar` was never set. To safely check for the existence and non-null value of a variable, you **MUST** check for both conditions.

```

/* Correct and Safe Example: */
if (myInjectedVar == null || myInjectedVar == void) {
    /* The variable is either not set or has been explicitly set to null. */
    tasker.log("Variable is not available.");
}

/* Incorrect and Unsafe Example: */
if (myInjectedVar == null) {
    /* This line will CRASH if the variable was never set. */
}
```

- `java.util.Map<java.lang.String, java.lang.Object> getJavaVariables()`
  Gets a Map<String,Object> of both global and local Java variables. If there are variables with the same name, the local variables take precedence.
- `java.util.Map<java.lang.String, java.lang.Object> getLocalJavaVariables()`
  Gets a Map<String,Object> of the local Java variables available in the current task. These do not include global variables.
- `java.util.Map<java.lang.String, java.lang.Object> getGlobalJavaVariables()`
  Gets a Map<String,Object> of the global Java variables available that can be accessed in any Task in Tasker. These do not include local task variables.
- `void clearGlobalJavaVariables()`
  Clears all global Java objects from memory. This is important for managing memory if you use global Java objects extensively.
  *Example:* `tasker.clearGlobalJavaVariables();`
- `void log(String message, ...)`
  Writes a debug message to the Tasker log which is sent to the system log or external storage, depending on what you enabled in Tasker Preferences. This is the only correct way to log from your code. Do not use `System.out.println()`.
  This method has several overrides:
  - `log(String message)`
  - `log(String message, String filePath)`
  - `log(String message, String filePath, String level)`
  - `log(String message, String filePath, String level, String tag)`
  *Example:* `tasker.log("Processing item number " + i);`
- `Disposable logAndToast(CharSequence message, ...)`
  Calls the `log()` function followed by `showToast()` with the provided text. Useful for debugging when you need immediate on-screen feedback.
  - `logAndToast(CharSequence message)`
  - `logAndToast(CharSequence message, String filePath)`
  *Example:* `tasker.logAndToast("Operation Complete");`
- `Disposable showToast(CharSequence text, ... )`
  Shows a simple on-screen toast. This method has three available overrides:
  - `showToast(CharSequence text)`: Standard toast.
  - `showToast(CharSequence text, CharSequence title)`: Toast with a title.
  - `showToast(CharSequence text, CharSequence title, Drawable icon)`: Toast with a title and an icon.
  *Example:* `tasker.showToast("Hello World");`
- `IBinder getShizukuService(String name)`
  Gets a system service via Shizuku for privileged operations. This will cause an error if Shizuku is not available.
  *Example:* `IBinder cs = tasker.getShizukuService("clipboard");`
- `NotificationListenerService getNotificationListener()`
  Gets the bound Notification Listener service to interact with notifications. Returns `null` if the service is not available, so your code must handle this.
  *Example:* `if (tasker.getNotificationListener() != null) { ... }`
- `Observable<NotificationUpdate> getNotificationUpdates()`
  Returns an RxJava2 Observable of `com.joaomgcd.taskerm.helper.NotificationUpdate` events. You can subscribe to this stream to react to notification changes in real-time.
  The `NotificationUpdate` object has exactly two methods:
  - `boolean getCreated()`: Returns `true` if the notification was posted (created), and `false` if the notification was removed.
  - `android.service.notification.StatusBarNotification getStatusBarNotification()`: Returns the `android.service.notification.StatusBarNotification` object that was either posted or removed.
- `boolean callTask(String taskName, HashMap params)`
  Runs a Tasker task by name, optionally passing parameters.
  This method asynchronously starts the specified task. It returns `true` if the task was successfully queued to run, and `false` otherwise. It does **not** wait for the task to complete and does not provide a result from the task. A 3-argument override `callTask(String taskName, HashMap params, int priority)` runs the task at a specific priority; higher numbers win when several tasks are queued on Tasker's single work thread.
  **Parameters:**
  - **`taskName`**: The exact name of the Tasker task to run.
  - **`params`**: A `HashMap` where keys are local variable names (without the '%' prefix) and values are the string values to pass to the task. Can be `null` if no parameters are needed.
  **Example: Running a task with parameters**

```

import java.util.HashMap;

/* Create a map to hold the parameters. */
params = new HashMap();
params.put("device_name", "Living Room TV");
params.put("command", "volume_up");

/* Call the 'Control Device' task with the specified parameters. */
boolean started = tasker.callTask("Control Device", params);

if (started) {
    tasker.log("Successfully started the 'Control Device' task.");
} else {
    tasker.log("Failed to start the 'Control Device' task.");
}
```

- `String sendCommand(String command)`
  Sends a command that can trigger the "Command" event in Tasker, allowing you to trigger other profiles or tasks. Equivalent to using the "Command" action.
  *Example:* `tasker.sendCommand("my_custom_command=:=value");`
- `AccessibilityService getAccessibilityService()`
  Returns an instance of Tasker's accessibility service if it's running. Returns `null` otherwise.
  This service object includes the helper method `List<AccessibilityNodeInfo> getChildrenRecursive(AccessibilityNodeInfo node)` to easily retrieve all child elements. You can use it with `accessibilityService.getRootInActiveWindow()` to get all elements on the screen.
  *Example:* `if (tasker.getAccessibilityService() != null) { ... }`
- `Observable<AccessibilityEvent> getAccessibilityEvents()`
  Returns an RxJava2 Observable of Accessibility events. You can subscribe to this stream to detect and react to UI changes, clicks, and text changes across the system.
  **Example: Creating a background text monitor**
  This example creates a persistent monitor that toasts any text typed into an EditText field in any app. It uses a global Java variable to handle cleanup so you can stop it later.

```

import android.view.accessibility.AccessibilityEvent;
import io.reactivex.functions.Consumer;
import io.reactivex.functions.Predicate;
import io.reactivex.functions.Action;
import io.reactivex.subjects.CompletableSubject;
import java.util.List;
import com.joaomgcd.taskerm.action.java.JavaCodeException;

/* 
 * Clean up any previous instance of this script by triggering the old signal.
 * We use getJavaVariable safely to check if the global variable exists.
 */
oldSignal = tasker.getJavaVariable("accKillSignal");
if (oldSignal != null && oldSignal != void) oldSignal.onComplete();

/* Create a new kill signal subject. */
killSignal = CompletableSubject.create();

/* 
 * Store it as a Global Java Variable.
 * Another task can retrieve this using 'accKillSignal' and call .onComplete() to stop this monitor.
 */
tasker.setJavaVariable("accKillSignal", killSignal);

/* Get the event stream. */
events = tasker.getAccessibilityEvents();
if (events == null) throw new JavaCodeException("Accessibility Service not available.");

/* 
 * Subscribe using takeUntil to handle the stop signal.
 * Use doFinally to clean up the global variable when the subscription ends.
 */
disposable = events.takeUntil(killSignal.toObservable())
    .doFinally(new Action() {
        run() {
            /* Clear the global variables so they don't linger in memory. */
            tasker.setJavaVariable("accKillSignal", null);
			tasker.setJavaVariable("accDisposable", null);
        }
    })
    .filter(new Predicate() {
    boolean test(Object obj) {
        AccessibilityEvent event = (AccessibilityEvent) obj;
        
        /* Filter for text changes. */
        if (event.getEventType() != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) return false;

        /* Filter for EditText. */
        if (event.getClassName() == null) return false;
        if (!"android.widget.EditText".contentEquals(event.getClassName())) return false;

        return true;
    }
}).subscribe(new Consumer() {
    accept(Object obj) {
        AccessibilityEvent event = (AccessibilityEvent) obj;
        List textList = event.getText();
        
        /* Check for valid text. */
        if (textList == null) return;
        if (textList.isEmpty()) return;
        
        tasker.showToast("Input: " + textList.get(0));
    }
});
/* CRITICAL: Store the subscription in a global variable so it's not garbage collected */
tasker.setJavaVariable("accDisposable", disposable);
```

  **Example: Stopping the monitor**
  Run this code in a separate action (or task) to stop the monitor created above.

```

import io.reactivex.subjects.CompletableSubject;

/* Retrieve the global signal variable. */
killSignal = tasker.getJavaVariable("accKillSignal");

/* Check if it exists and is valid. */
if (killSignal != null && killSignal != void) {
    /* Trigger completion. This stops the subscription in the other task. */
    killSignal.onComplete();
    tasker.showToast("Monitor Stopped");
} else {
    tasker.showToast("Monitor was not running");
}
```

- `Object implementClass(...)`
  Dynamically extends or implements any class (concrete or abstract) to intercept its method calls. This is a powerful tool for adding logging, modifying behavior, or handling abstract classes where traditional anonymous classes fail in BeanShell.
  - **How it works:** You provide a class to extend (e.g., `Intent.class`) and an implementation of the `ClassImplementation` interface. Your implementation's `run` method will be called for *every* method invoked on the created object.
  - **Handler Interface:** Your handler must implement `com.joaomgcd.taskerm.action.java.ClassImplementation`. Remember to import this class at the top of your script.
  - **The `run` method parameters:**
    - `**Callable superCaller**`: This is the most important parameter. It is a handle to the original method that was called. To execute the original method, you **must** call `superCaller.call()`. The value returned by `.call()` is the original method's return value. This allows you to run code *before* or *after* the original logic.
    - `**String methodName**`: The name of the method being called (e.g., `"putExtra"`).
    - `**Object[] args**`: An array of arguments passed to that method.
  - **CRITICAL SYNTAX RULE:** Due to a BeanShell limitation, you **MUST** write the `run` method signature without a return type or access modifier. The line must be written literally as `run(Callable superCaller, String methodName, Object[] args){ ... }`.

##### Signatures

  **1. Basic Implementation (No-Argument Constructor)**
  `Object implementClass(java.lang.Class<?>, com.joaomgcd.taskerm.action.java.ClassImplementation)`
  **2. Implementation with Specific Constructor**
  `Object implementClass(java.lang.Class<?>, com.joaomgcd.taskerm.action.java.ClassImplementation, java.lang.Class<?>[], java.lang.Object[])`

##### Example 1: Logging method calls on a concrete class

```

/* Import the necessary classes. */
import com.joaomgcd.taskerm.action.java.ClassImplementation;
import android.content.Intent;
import java.util.concurrent.Callable;

/* Create a proxied Intent object. */
intent = tasker.implementClass(Intent.class, new ClassImplementation(){
    run(Callable superCaller, String methodName, Object[] args){
        tasker.log("Method Logger: about to call " + methodName);
        
        /* Execute the original method and capture its result. */
        Object result = superCaller.call();

        tasker.log("Method Logger: finished " + methodName +". Got result: " + result);
        
        /* Return the original result to preserve functionality. */
        return result;
    }
});

/* 
 * Now, when you use this 'intent' object, every method call will be logged.
*/
intent.putExtra("aaa","coool");
intent.getStringExtra("aaa");
```

##### Example 2: Implementing an abstract BroadcastReceiver

```

import com.joaomgcd.taskerm.action.java.ClassImplementation;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.Intent;
import java.util.concurrent.Callable;
import io.reactivex.subjects.CompletableSubject;

screenOffSignal = CompletableSubject.create();
filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);

screenOffReceiver = tasker.implementClass(BroadcastReceiver.class, new ClassImplementation(){
    run(Callable superCaller, String methodName, Object[] args){
        /* 
         * Check for the specific abstract method we want to implement.
         * For any other method, we MUST call superCaller to preserve
         * the original behavior (e.g., for toString(), equals(), etc.).
        */
        if (!methodName.equals("onReceive")) {
            return superCaller.call();
        }
        
        /* This is our custom implementation for the 'onReceive' method. */
        tasker.log("Screen just went OFF!");
        screenOffSignal.onComplete();
        return null; /* onReceive is a void method. */
    }
});

context.registerReceiver(screenOffReceiver, filter);

try {
    screenOffSignal.blockingAwait();    
    tasker.log("...Signal received!");
} finally {
    context.unregisterReceiver(screenOffReceiver);
}
```

##### Example 3: Using a specific constructor

```

import com.joaomgcd.taskerm.action.java.ClassImplementation;
import android.widget.ArrayAdapter;
import android.content.Context;
import java.util.concurrent.Callable;

// We want to call the ArrayAdapter(Context context, int resource, T[] objects) constructor.
constructorTypes = new Class[]{ Context.class, int.class, Object[].class };
String[] myItems = new String[]{"Item 1", "Item 2", "Item 3"};
constructorArgs = new Object[]{ context, android.R.layout.simple_list_item_1, myItems };

myAdapter = tasker.implementClass(
    ArrayAdapter.class, 
    new ClassImplementation(){
        run(Callable superCaller, String methodName, Object[] args){
            if (methodName.equals("getCount")) {
                tasker.log("ArrayAdapter.getCount() was called!");
            }
            return superCaller.call();
        }
    },
    constructorTypes,
    constructorArgs
);

tasker.log("Adapter count is: " + myAdapter.getCount());
```

- `TaskForHelper getTask()`
  Gets an object with information about the currently running task.
  The `TaskForHelper` object has the following methods:
  - `String getName()`: Gets the name of the current task.
  - `int getTaskId()`: Gets the ID of the running task.
  - `int getProjectId()`: Gets the project ID that contains the task.
  - `java.lang.Integer getProfileId()`: Gets the eventual profile id of the profile that launched the running task. May be null.
  - `List<ActionForHelper> getActions()`: Gets a list of all actions in the task.
  - `int getActionCount()`: Gets the number of actions in this task.
  - `int getCurrentActionIndex()`: Gets the 0-based index of this Java Code action.
  - `ActionForHelper getNextAction()`: Gets the next action in the task.
  - `ActionForHelper getPreviousAction()`: Gets the previous action in the task.
  The `ActionForHelper` object has the following methods:
  - `int getCode()`: Gets the action's internal code.
  - `String getName()`: Gets the action's display name.
- `Bundle getTaskVariables()`
  Gets a Bundle object containing all of the current task's variables.
  *Example:* `Bundle vars = tasker.getTaskVariables();`
- `String toJson(Object object, ...)`
  Converts a Java object into its JSON string representation.
  - `toJson(Object object)`: Converts to a compact, non-pretty JSON string.
  - `toJson(Object object, boolean pretty)`: If `pretty` is `true`, the JSON will be formatted for readability.
  *Example:* `String prettyJson = tasker.toJson(myObject, true);`
- `void doWithActivity(Consumer consumer)`
  Runs code within a temporary Activity context.
  This is the solution for running APIs that require an `Activity` and will not work with the default `Service` context. A prime example is showing an `AlertDialog` or any other UI element, which will crash if attempted from a service.
  **How it works:**
  1. You provide a `java.util.function.Consumer` as the argument. You must import this class.
  2. The function creates a temporary, invisible Activity behind the scenes.
  3. It then calls your `Consumer`'s `accept(Activity activity)` method, giving you access to the live `Activity` instance.
  4. Since this function uses a `Consumer`, it **does not return a value**. Its purpose is to *perform an action* with the Activity.

##### CRITICAL RULES - READ CAREFULLY

  - **Your Code Runs on the Main Thread:** The code inside your `Consumer` executes on the Android Main (UI) Thread. Any long-running operations will freeze the app's UI. You **must** use RxJava2 or start a new `Thread` to perform background work.
  - **You MUST Finish the Activity:** You are responsible for closing the Activity. You **MUST** call `activity.finish()` inside your code when you are done. If you don't, the invisible activity will linger in the background. For asynchronous UI like a Dialog, this means calling `finish()` **inside the dialog's button listeners**.
  **Example: Showing a Confirmation Dialog and Waiting for the Result**
  This example correctly demonstrates all the rules: it shows a dialog, pauses the script until the user clicks a button, and safely closes the temporary activity.

```

import java.util.function.Consumer;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import io.reactivex.subjects.SingleSubject;

/* Use a SingleSubject to wait for the dialog's result. */
resultSignal = SingleSubject.create();

/* Create a Consumer to build and show the dialog. */
myActivityConsumer = new Consumer() {
    accept(Object activity) {
        final Activity currentActivity = (Activity) activity;

        onClickListener = new DialogInterface.OnClickListener() {
            onClick(DialogInterface dialog, int which) {
                String result = "cancel";
                if (which == DialogInterface.BUTTON_POSITIVE) {
                    result = "ok";
                }
                resultSignal.onSuccess(result);
                currentActivity.finish(); /* CRITICAL: Finish activity here! */
            }
        };

        AlertDialog.Builder builder = new AlertDialog.Builder(currentActivity);
        builder.setTitle("Confirmation");
        builder.setMessage("Do you want to proceed?");
        builder.setPositiveButton("OK", onClickListener);
        builder.setNegativeButton("Cancel", onClickListener);
        builder.setCancelable(false);
        builder.create().show();
    }
};

/* Execute the consumer to show the dialog. */
tasker.doWithActivity(myActivityConsumer);

/* Block the script and wait for the signal from the button listener. */
userChoice = resultSignal.blockingGet();

return userChoice;
```

- `Single<Intent> getWithActivityForResult(Intent intent)`
  Handles the `startActivityForResult` flow, returning a `Single<Intent>`.
  This is the standard way to get data from other apps that require user interaction, like picking a file, selecting a contact, or choosing an account.
  **How it works:**
  1. You provide an `Intent` that launches an activity designed to return a result (e.g., `new Intent(Intent.ACTION_GET_CONTENT)`).
  2. The function starts that activity and **immediately returns a `Single<Intent>` object**.
  3. This `Single` acts as a placeholder for the result. It will emit the final `Intent` object only after you complete the action in the other activity and it closes.
  **What to do with the `Single<Intent>`:**
  You must subscribe to the `Single` to get the result. The most common way to do this is by using `.blockingGet()`, which pauses the script until the result is available.
  **Example: Basic Usage (Blocking immediately)**

```

import android.content.Intent;

/* Create an intent to pick any file. */
intent = new Intent(Intent.ACTION_GET_CONTENT);
intent.setType("*/*");

/* Start the activity and get the Single placeholder. */
resultSingle = tasker.getWithActivityForResult(intent);

/* Block the script and wait for the user to pick a file. */
resultIntent = resultSingle.blockingGet();

/* Extract the data (e.g., the file's URI) from the result. */
fileUri = resultIntent.getData();
return fileUri.toString();
```

  **Example: Advanced Usage (Adding a Timeout)**
  The flexibility of returning a `Single` allows you to add operators like `timeout`.

```

import android.content.Intent;
import java.util.concurrent.TimeUnit;

intent = new Intent(Intent.ACTION_GET_CONTENT);
intent.setType("*/*");

resultSingle = tasker.getWithActivityForResult(intent);

try {
    /* Wait for the result, but with a 30-second timeout. */
    resultIntent = resultSingle.timeout(30, TimeUnit.SECONDS).blockingGet();
    return resultIntent.getData().toString();
} catch (Exception e) {
    tasker.log("User did not pick a file within 30 seconds.");
    return "timeout";
}
```

- `String convertToRealFilePath(Uri uri)`
  **Attempts to convert a `content://` URI to a real, direct file path.**
  **Use Case:** Android's modern security model often provides `content://` URIs instead of direct file paths (e.g., when you pick a file). This function acts as a bridge for tools or code that require a traditional, absolute path like `/storage/emulated/0/Download/MyFile.pdf`.
  **IMPORTANT:** This conversion is **not guaranteed to succeed** and may return `null`, especially if the URI points to a cloud file (like from Google Drive) or other virtual content. You **MUST** always check if the result is `null`.
  **Example: Picking a File and Getting Its Real Path**

```

import android.content.Intent;
import android.net.Uri;

/* 1. Get the result Intent from the file picker. */
intent = new Intent(Intent.ACTION_GET_CONTENT);
intent.setType("*/*");
resultIntent = tasker.getWithActivityForResult(intent).blockingGet();

if (resultIntent == null) return "User cancelled.";

/* 2. Get the content URI from the result. */
contentUri = resultIntent.getData();
if (contentUri == null) return "Could not get file URI.";
tasker.log("Got content URI: " + contentUri);

/* 3. Attempt to convert the content URI to a real file path. */
realPath = tasker.convertToRealFilePath(contentUri);

/* 4. CRITICAL: Check if the conversion succeeded. */
if (realPath != null) {
    tasker.log("Successfully converted to real path: " + realPath);
    return realPath;
} else {
    tasker.log("Failed to convert URI to a real path.");
    return "Could not get real file path.";
}
```

- `void showSceneV2(String nameOrJson, ...)`
  Shows a Scene V2, identified either by its name or by inline scene JSON. The code continues immediately without waiting for any interaction. Use `showSceneV2ForResult` instead when you need to wait for the scene to be dismissed and read back its values.
  The available overrides let you set a Screen ID, a display mode and overlay options:
  - `showSceneV2(String nameOrJson)`: Shows the scene fullscreen.
  - `showSceneV2(String nameOrJson, String screenId)`: Assigns a Screen ID. Use a unique id so you can later update or dismiss this specific scene.
  - `showSceneV2(String nameOrJson, String screenId, String displayMode)`: `displayMode` is one of `'Fullscreen'`, `'Dialog'` or `'Overlay'`.
  - `showSceneV2(String nameOrJson, String screenId, String displayMode, boolean showOverEverything, boolean longClickRootToDismiss)`: Overlay options. `showOverEverything` uses the Accessibility Overlay to draw over other overlays and some system windows; `longClickRootToDismiss` adds a long-press dismiss gesture on the root element. Only apply when `displayMode` is `'Overlay'`.
  - `showSceneV2(String nameOrJson, String screenId, String displayMode, String x, String y)` and the variant with `String width, String height`: Overlay position and size. Values are in dp (e.g. `'100'`) or percentage (e.g. `'50%'`); use negative values to position from the opposite edge. Only apply when `displayMode` is `'Overlay'`.
  - Variants adding `boolean blocking` control whether the overlay blocks touches behind it (`true`) or lets them pass through (`false`), and the fullest variant also takes `showOverEverything` and `longClickRootToDismiss`.
  *Example:* `tasker.showSceneV2("My Scene", "myScreen", "Overlay", "10", "10%");`
- `Single<Map<String, List>> showSceneV2ForResult(String nameOrJson, ...)`
  Shows a Scene V2 and returns a `Single` that emits when the user dismisses the scene. The emitted `Map` keys are variable names and the values are lists of one or more values for each variable. Call `.blockingGet()` to wait for the result on the background thread, or `.subscribe()` for async handling.
  Overrides accept a Screen ID, a display mode, overlay position/size/blocking, the overlay options, and a timeout:
  - `showSceneV2ForResult(String nameOrJson)`
  - `showSceneV2ForResult(String nameOrJson, String screenId)`
  - `showSceneV2ForResult(String nameOrJson, String screenId, String displayMode)`
  - `showSceneV2ForResult(String nameOrJson, String screenId, String displayMode, long timeoutMs)`: `timeoutMs` is in milliseconds (`0` for no timeout). The `Single` errors if the timeout is exceeded.
  - Fuller overrides add overlay `x, y, width, height, blocking` (and `showOverEverything, longClickRootToDismiss`) before the final `timeoutMs`.
  *Example:*

```

/* Show a login scene and wait for the user to submit it. */
result = tasker.showSceneV2ForResult("Login Scene").blockingGet();

/* result is a Map of variable name to a List of values. */
usernames = result.get("username");
if (usernames == null || usernames.isEmpty()) return null;
return usernames.get(0);
```

- `Single<Map<String, List>> waitForSceneV2Result(String screenId, ...)`
  Waits for an already-showing Scene V2 to be dismissed and returns a `Single` of the result map (variable name to list of values), exactly like `showSceneV2ForResult`. The scene must already be active. This is useful when one action shows the scene and a later action waits for its result.
  - `waitForSceneV2Result(String screenId)`
  - `waitForSceneV2Result(String screenId, long timeoutMs)`: `0` means no timeout; the `Single` errors if the timeout is exceeded.
- `void dismissSceneV2(String screenId)`
  Dismisses a specific Scene V2 by its Screen ID.
  *Example:* `tasker.dismissSceneV2("myScreen");`
- `void dismissAllScenesV2()`
  Dismisses all currently active Scene V2 screens.
  *Example:* `tasker.dismissAllScenesV2();`
- `void updateSceneV2(String elementId, String property, String value, ...)`
  Updates a property of an element in an active Scene V2 while it is showing.
  - `updateSceneV2(String elementId, String property, String value)`: Updates the element in all currently active scenes.
  - `updateSceneV2(String elementId, String property, String value, String screenId)`: Updates the element only in the given screen.
  *Example:* `tasker.updateSceneV2("myButton", "text", "Hello");`
- `void updateSceneV2Overlay(String screenId, String x, String y, ...)`
  Moves and resizes an overlay Scene V2 while it is showing. Position and size values are in dp (e.g. `'100'`) or percentage (e.g. `'50%'`).
  - `updateSceneV2Overlay(String screenId, String x, String y)`: Updates the position.
  - `updateSceneV2Overlay(String screenId, String x, String y, String width, String height)`: Updates position and size.
  - `updateSceneV2Overlay(String screenId, String x, String y, String width, String height, boolean blocking, int transitionDurationMs)`: Also sets touch blocking and an animation duration in milliseconds.
- `boolean isSceneV2Active(String screenId)`
  Returns `true` if a Scene V2 with the given Screen ID is currently shown.
  *Example:* `if (tasker.isSceneV2Active("myScreen")) { ... }`
- `Observable<SceneV2EventContext> getSceneV2Events(...)`
  Returns an RxJava2 `Observable` of `SceneV2EventContext` events, emitted whenever a Scene V2 component is interacted with (clicked, toggled, swiped, and so on). Use `.subscribe()` for async monitoring or `.blockingFirst()` to wait for the next event.
  Each `SceneV2EventContext` has the fields: `sceneName`, `screenId`, `elementId`, `elementPath`, `elementValue`, `interactionType` and `outputVariables`.
  - `getSceneV2Events()`: Events from any scene.
  - `getSceneV2Events(String screenId)`: Events from one screen.
  - `getSceneV2Events(String screenId, String elementId)`: Events from one element of one screen.
- `SceneV2EventContext waitForSceneV2Event(...)`
  Blocks until the next Scene V2 component interaction and returns its `SceneV2EventContext` (see `getSceneV2Events` for the available fields).
  - `waitForSceneV2Event()`: Waits for the next interaction in any scene.
  - `waitForSceneV2Event(String screenId)`: Waits for the next interaction in one screen.
  - `waitForSceneV2Event(String screenId, String elementId)`: Waits for the next interaction with one element.
- `void setProfileEnabled(String profileName, boolean enabled)`
  Enables or disables all Tasker profiles with the given name, exactly like the "Profile Status" action. Throws a `JavaCodeException` if no profile with that name exists.
  *Example:* `tasker.setProfileEnabled("My Profile", false);`
- `void toggleProfileEnabled(String profileName)`
  Toggles the enabled state of all Tasker profiles with the given name, exactly like the "Profile Status" action set to Toggle. Throws a `JavaCodeException` if no profile with that name exists.
  *Example:* `tasker.toggleProfileEnabled("My Profile");`
- `CommandResult runShell(String command, ...)`
  Runs a shell command at the best available privilege, preferring Root, then Shizuku, then ADB WiFi, then a normal unprivileged shell. It returns a `com.joaomgcd.taskerm.shell.CommandResult` with these methods:
  - `int getExitCode()`: The command's exit code.
  - `List getOutput()`: The standard output, as a list of lines.
  - `String getOutputString()`: The standard output joined into a single newline-separated string (`null` if there was none).
  - `List getError()`: The standard error, as a list of lines.
  - `String getErrorString()`: The standard error joined into a single newline-separated string (`null` if there was none).
  - `boolean getSuccess()`: `true` when the exit code is 0.
  The default timeout is 30 seconds. Use the two-argument override `runShell(String command, int timeoutSeconds)` for a different timeout; a `JavaCodeException` is thrown if the timeout is exceeded.
  **Backend differences:** The Root and normal-shell backends report `getExitCode()` as only 0 (success) or 1 (failure). The ADB WiFi backend reports `getExitCode()` as 0 and puts all output, including errors, in `getOutput()` with `getError()` empty. Only the Shizuku backend reports the real exit code, stdout and stderr separately.
  *Example:*

```

result = tasker.runShell("getprop ro.product.model");
if (result.getSuccess()) return result.getOutputString();
return "Failed with exit code " + result.getExitCode();
```

- `CommandResult runShellRoot(String command, ...)`
  Runs a shell command as root and returns a `CommandResult` (see `runShell`). It does **not** check whether root is available first; if it is not, the command simply fails in the returned result. Call `isRootAvailable()` first if you want to verify. The root backend reports `getExitCode()` as only 0 or 1. A two-argument override `runShellRoot(String command, int timeoutSeconds)` sets a custom timeout (default 30 seconds).
- `CommandResult runShellShizuku(String command, ...)`
  Runs a shell command via Shizuku and returns a `CommandResult` (see `runShell`) with the real exit code, stdout and stderr. It does **not** check whether Shizuku is available first; call `isShizukuAvailable()` to verify. A two-argument override `runShellShizuku(String command, int timeoutSeconds)` sets a custom timeout (default 30 seconds).
  **Note:** A Shizuku command that never finishes cannot be force-killed by the timeout; the call will not return until the command completes on its own.
- `CommandResult runShellAdbWifi(String command, ...)`
  Runs a shell command via ADB over WiFi and returns a `CommandResult` (see `runShell`). It does **not** check whether ADB WiFi is available first; call `isAdbWifiAvailable()` to verify. This backend reports `getExitCode()` as 0 and puts all output (including errors) in `getOutput()`. A two-argument override `runShellAdbWifi(String command, int timeoutSeconds)` sets a custom timeout (default 30 seconds).
- `boolean isRootAvailable()`
  Returns `true` if root is available. May trigger the device's root permission prompt the first time, like other root checks in Tasker. This check is optional; the `runShell...` methods do not call it automatically.
- `boolean isShizukuAvailable()`
  Returns `true` if Shizuku is running and authorized. This check is optional; the `runShell...` methods do not call it automatically.
- `boolean isAdbWifiAvailable()`
  Returns `true` if ADB over WiFi is set up and reachable. This check is optional; the `runShell...` methods do not call it automatically.

You can also access Java objects that were created and returned by other Tasker Java actions (like **Java Function**) within your code.

Third-Party Libraries

You have access to specific third-party libraries to simplify common tasks without needing manual imports or complex setups.

##### OkHttp3 (Web Requests)

Use this for all HTTP requests. Since your script runs on a background thread, you should prefer **synchronous** calls (`execute()`) over asynchronous callbacks to keep the code linear and readable.

```

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

client = new OkHttpClient();
request = new Request.Builder()
    .url("https://www.example.com")
    .build();

/* Execute synchronously. */
response = client.newCall(request).execute();
body = response.body().string();
return body;
```

##### Coil (Image Loading)

Use Coil to load images from URLs.

- **Loading into an ImageView (Preferred):** Use the asynchronous `enqueue()` method with `.target(imageView)`. This prevents UI freezes (e.g., in custom Dialogs) by loading images in the background while keeping the UI responsive.
- **Loading Raw Data:** Use the synchronous `execute()` method only if you need the actual `Bitmap` or `Drawable` object for processing within the script.

**Example: Async loading into an ImageView**

```

import coil.Coil;
import coil.request.ImageRequest;

/* Assume 'myImageView' is an existing view in your layout/dialog. */
request = new ImageRequest.Builder(context)
    .data("https://www.example.com/image.png")
    .target(myImageView)
    .build();

/* Load in background without blocking the script or UI. */
Coil.imageLoader(context).enqueue(request);
```

Asynchronous Operations with RxJava

The **RxJava2** library is available for handling asynchronous operations like waiting for events, performing background work, or running code after a delay. The action will automatically wait for your reactive stream to complete before proceeding.

You **must** end your RxJava chain with a blocking operator (like `blockingAwait()`, `blockingGet()`, or `blockingFirst()`). This is what tells the action to wait for your asynchronous operation to finish.

**Waiting for Events with Subjects (Recommended)**

To wait for an event from a callback (like in a `BroadcastReceiver` or another listener), the cleanest approach is to use a **Subject**. You create a subject, use it within your callback implementation to signal that an event has occurred, and then block the script until that signal is received. This is much simpler than using complex operators like `Completable.create()`.

**Example: Using a Subject to wait for a signal**

```

import io.reactivex.subjects.CompletableSubject;

/* Create a subject that will act as our signal. */
mySignal = CompletableSubject.create();

/*
 * In another part of your code (e.g., inside the 'run' method of an
 * implemented BroadcastReceiver), you would signal completion like this:
 *
 * mySignal.onComplete();
 *
 * See the `implementClass` BroadcastReceiver example for a practical use case.
*/

/* This line will block and wait until onComplete() is called. */
mySignal.blockingAwait();

tasker.log("Signal received, script can now continue.");
```

**Simple Delays and Timers**

For basic delays, using a simple timer is still appropriate.

**Example: Wait for 3 seconds**

```

import java.util.concurrent.TimeUnit;
import io.reactivex.Completable;

/* Wait for 3 seconds on a background thread. */
Completable.timer(3, TimeUnit.SECONDS).blockingAwait();

/* This code will run after the 3-second delay. */
tasker.log("3 seconds have passed.");
```

**Example: Get a value after a delay**

```

import java.util.concurrent.TimeUnit;
import io.reactivex.Single;
import io.reactivex.functions.Function;

/* Get the string "Hello" after a 1 second delay. */
result = Single.timer(1, TimeUnit.SECONDS)
               .map(new Function() {
                   apply(Object aLong) {
                       return "Hello";
                   }
               })
               .blockingGet();

return result; /* Returns "Hello" */
```

Return Value

The value from your code's **return** statement will be stored in the output variable specified in the "Return" field. Any variables you declare inside your code are temporary and will be discarded when the action finishes.

The scope (local or global) of the returned value is determined by the capitalization of the variable name you choose:

- **Without a % prefix (stores as a Java Object)**
  This is ideal for passing complex data, like a `List` or custom object, to another Java-based action. The actual Java object is stored in memory.
  - **All lowercase name** (e.g. `my_object`, `resultslist`): The object is stored **locally** and is only available within the current task.
  - **Name contains at least one uppercase letter** (e.g. `myGlobalObject`, `persistentList`): The object is stored **globally** and persists across different tasks.
    - **CRITICAL:** The first letter of a global Java object name **must** be lowercase (e.g., `myGlobalObject` is valid, but `MyGlobalObject` is not).
    Important: Global Java objects persist in memory. If you no longer need one, you should manually clear it using the `tasker.clearGlobalJavaVariables()` method or the **Java Function** action to prevent memory leaks.
- **With a % prefix (stores as a standard Tasker Variable)**
  The object's `.toString()` method is called, and the resulting text is stored in a Tasker variable.
  - **All lowercase name** (e.g. `%result`, `%http_data`): The variable is **local** to the current task.
  - **Name contains at least one uppercase letter** (e.g. **%Result**, **%LastLocation**): The variable is **global** and accessible from any task.
    - **Convention:** Avoid using all-uppercase names (e.g., `%WIFI`). These are typically reserved for Tasker's built-in read-only variables.

Variable Typing and Scope

BeanShell supports both strong and dynamic typing. You do not need to declare a specific type when creating a variable, and you can reassign values of different types to the same variable without errors-similar to how Tasker handles variables.

**Scope inside Functions:** The behavior of a variable inside a function depends on how it is initialized:

- **With a type declaration:** If you specify a type (e.g., `String i = ...`), the variable is **local** to that function and will not affect variables with the same name outside of it.
- **Without a type declaration:** If you simply assign a value (e.g., `i = ...`), BeanShell will look for that variable in the **outer scope** and modify it directly.

**Example: Local Scope** (Returns "1")

```

i = "1";
test() {
    String i = "12"; /* Declared with a type: it's a new local variable. */
}
test();
return i;
```

**Example: Outer Scope** (Returns "12")

```

i = "1";
test() {
    i = "12"; /* Assigned without a type: modifies the existing 'i' variable. */
}
test();
return i;
```

**Warning:** This is a very powerful action for advanced users. The code you write is not sandboxed and can modify your device's settings or data. The BeanShell interpreter does not support modern Java features like Generics (<...>), Lambdas, or Streams.

##### Example

You can use the following code to set the **%wifi** variable to the name of currently connected Wifi Network.

Java Code:

```

import android.content.Context;
import android.net.wifi.WifiManager;
import android.net.wifi.WifiInfo;

/* Get the WifiManager service. */
WifiManager wifiManager = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);

/* If WiFi manager is unavailable or WiFi is disabled, exit. */
if (wifiManager == null || !wifiManager.isWifiEnabled()) return null;

/* Get information about the currently connected WiFi network. */
WifiInfo wifiInfo = wifiManager.getConnectionInfo();
if (wifiInfo == null) return null;

/* Get the raw SSID string. */
String ssid = wifiInfo.getSSID();
if (ssid == null) return null;

/* Remove surrounding quotes from the SSID if they exist. */
if (ssid.startsWith("\"") && ssid.endsWith("\"")) ssid = ssid.substring(1, ssid.length() - 1);

/* Return the cleaned SSID. */
return ssid;
```

Return Field:

```
%wifi
```
