# Variable Split

Source: https://tasker.joaoapps.com/userguide/en/help/ah_split_variable.html

Split the value of the given variable into several sub-variables.

Each time Splitter is encountered in the variable value, a new variable is made with name %VARX.

If Delete Base is selected, the original variable is removed after the split.

Example: %VAR contains "I;like;humus". After the action Split/%VAR/;/Yes %VAR is replaced with 3 variables %VAR1, %VAR2 and %VAR3 containtin "I", "like" and "humus".
