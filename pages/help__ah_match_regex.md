# Simple Match/Regex

Source: https://tasker.joaoapps.com/userguide/en/help/ah_match_regex.html

Allows you to match some text with an easy to use pattern or with a powerful regex.

[Watch a demo here](https://youtu.be/m-i0yRwVjN4)

Allows you to match and extract data from a random piece of text, optionally creating local variables with the data in the process.

#### Simple Match

Will try to match the input text with the provided simple pattern. For example, if you have

- Text: my name is **Tim** and I'm **28** years old
- Simple Pattern: my name is **$name** and I'm **#age** years old

you'll successfully match the input text and will have 2 variables available in the task:**

- **%name**: Tim
- **%age**: 28

The **Simple Pattern** has the following rules:

- it is case-insentive.
- placeholder names as described below can only contain letters. No numbers allowed.
- $variable is used as a placeholder for any random text and will create a variable with that text
- #number is used as a placeholder for any digits and will create a variable with those digits
- you can use just **$** or **#** if you want to add a placeholder for some text that you don't need a variable for. For example, you could match the above sentence with **$ name is $name and $ #age years old** and it would still work, but it would also work with a sentence like **his name is Tim and he's 28 years old**

#### Regex

If simple matching is not working for you in a particular situation you can always resort to the power matching language, regex!

Learn more about regex [here](https://www.regular-expressions.info/tutorial.html).

In addition to normal regex rules, if you create a [named group](https://www.regular-expressions.info/named.html) like (?<variable>) it'll create a variable with the same name in Tasker (**%variable** in the example).

#### General Rules

- Each created variable can also be accessed as an array. In the above example you could also access **%name()** and **%age()** for example. This is because you can get multiple matches with just one pattern.
- **%mt_match** will contain the full matched text that corresponds to the pattern used
- **%mt_match_found** will contain **true** if a match and **false** if not. Can be useful to decide what you want to do in the task depending if the match was successful or not.
