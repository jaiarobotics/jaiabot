#!/bin/sh
FILES=$(git diff --cached --name-only --diff-filter=ACMR | sed 's| |\\ |g')
[ -z "$FILES" ] && exit 0

INCLUDE="web"
FILES=$(echo "$FILES" | grep -E "$INCLUDE")

# Prettify all selected files
prettier_project_path="src/web/node_modules/.bin/prettier"
prettier_abs_path=${PWD}"/${prettier_project_path}"

echo "$FILES" | xargs ${prettier_abs_path} --ignore-unknown --write

# Add back the modified/prettified files to staging
echo "$FILES" | xargs git add .

exit 0
