# Format JSON

Source: https://tasker.joaoapps.com/userguide/en/help/ah_format_json.html

Takes JSON text and outputs a reformatted version: either minified (compact, all on one line) or pretty-printed with the indentation you choose.

- Put the JSON you want to reformat in the **JSON** field. It can be a literal value or a variable like %myjson.
- Set **Format** to **Minify** to strip all spacing and line breaks, or to **Pretty** to lay the JSON out over multiple indented lines. Tap the magnifying glass to pick.
- When **Format** is **Pretty**, an **Indent** field appears. Enter the number of spaces to indent with (for example 2 or 4), or write **Tab** to indent with tabs. The magnifying glass offers the common choices.
- The result is placed in **%fj_formatted**.
- Key order and value types from the input are preserved. The action fails if the input is not a valid JSON object or array.
