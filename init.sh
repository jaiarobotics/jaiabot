#!/usr/bin/env bash
#
# Bootstraps a fresh clone of this repository: there's no 'jaia' tool yet to run
# "jaia dev setup" or "jaia dev build", so this script runs their underlying steps directly
# (scripts/build/setup-tools-build.sh, then "./build.sh jaia" to build just the 'jaia' CLI),
# then puts build/<arch>/bin on PATH so 'jaia' is available right away.
#
# Usage: source ./init.sh   (recommended: also updates PATH in this shell)
#        ./init.sh          (still builds jaia, but only future shells pick up the PATH change)

# True if this file is being sourced rather than executed, so we can safely 'return' on error
# and export PATH into the calling shell
if [ -n "${BASH_SOURCE:-}" ] && [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    sourced=true
elif [ -n "${ZSH_EVAL_CONTEXT:-}" ] && [[ "${ZSH_EVAL_CONTEXT}" == *:file:* ]]; then
    sourced=true
else
    sourced=false
fi

if [ -n "${BASH_SOURCE:-}" ]; then
    script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
else
    script_dir=$(cd "$(dirname "$0")" && pwd)
fi

# Note: 'return' from a function only returns from that function, not the sourced script, so
# the halt-on-error below is inlined at the top level rather than in a shared helper function
if ! "${script_dir}/scripts/build/setup-tools-build.sh"; then
    echo "❌ scripts/build/setup-tools-build.sh failed" >&2
    if [ "${sourced}" = true ]; then return 1; else exit 1; fi
fi

if ! "${script_dir}/build.sh" jaia; then
    echo "❌ ./build.sh jaia failed" >&2
    if [ "${sourced}" = true ]; then return 1; else exit 1; fi
fi

arch=$(dpkg --print-architecture)
bin_dir="${script_dir}/build/${arch}/bin"

if [ ! -x "${bin_dir}/jaia" ]; then
    echo "❌ Expected ${bin_dir}/jaia to exist after building" >&2
    if [ "${sourced}" = true ]; then return 1; else exit 1; fi
fi

rc_file="${HOME}/.bashrc"
case "${SHELL:-}" in
    */zsh) rc_file="${HOME}/.zshrc" ;;
esac

if ! grep -qsF "${bin_dir}" "${rc_file}" 2>/dev/null; then
    {
        echo ""
        echo "# added by jaiabot/init.sh"
        echo "export PATH=\"${bin_dir}:\${PATH}\""
    } >> "${rc_file}"
    echo "🟢 Added ${bin_dir} to PATH in ${rc_file}: future shells will pick this up"
else
    echo "🟢 ${bin_dir} is already in ${rc_file}"
fi

case ":${PATH}:" in
    *":${bin_dir}:"*) ;;
    *) export PATH="${bin_dir}:${PATH}" ;;
esac

if [ "${sourced}" = true ]; then
    echo "🟢 jaia is now on PATH for this shell too: $(command -v jaia)"
else
    echo "🟡 Run 'source ./init.sh' (instead of './init.sh') next time to put jaia on PATH in this shell too, or start a new shell to pick up the change"
fi

echo "🟢 Bootstrap complete. Run 'jaia dev build' to finish building the rest of the project."
