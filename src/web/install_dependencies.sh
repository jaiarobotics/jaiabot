#!/bin/bash

# Where is your package.json?
PACKAGE_JSON_DIR=$1

if [ -z "${PACKAGE_JSON_DIR}" ]; then
    PACKAGE_JSON_DIR="."
fi

echo 🟢 Installing npm dependencies in ${PACKAGE_JSON_DIR}

if ! which npm; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
fi

pushd ${PACKAGE_JSON_DIR} > /dev/null
    # Shut up unless there's an error!
    npm install --no-audit --no-progress --silent || npm install --no-audit --no-progress --quiet
popd > /dev/null
