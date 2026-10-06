#!/bin/bash

# sshd's AuthorizedKeysCommand on the CloudHub: the Jaia support account's keys,
# and only while the customer has that account in the jaia_support group.
#
# The group is part of the search rather than a check made afterwards, so
# removing the membership makes the next authentication fail with no file
# rewritten, no service reloaded and no cache to expire.

set -u -o pipefail

# Overridable so this can be run against a directory other than the live one.
SECRETS="${JAIA_AUTH_SECRETS:-/var/log/jaiabot/auth/authelia/secrets}"
# Loopback, not the container's published port: this must not be answerable
# from the network, and LLDAP's own guidance is LDAPS anywhere else.
LDAP_URI="${JAIA_LLDAP_URI:-ldap://127.0.0.1:3890}"

BASE_DN="dc=jaia,dc=tech"
ACCOUNT=jaia_support
BIND_ACCOUNT=authelia

# sshd asks for every login; only the local account support uses has keys here
[ "${1:-}" = "jaia" ] || exit 0

[ -r "${SECRETS}" ] || exit 0
authelia_ldap_password=""
. "${SECRETS}"
[ -n "${authelia_ldap_password}" ] || exit 0

# Binds as the directory's own service account, not jaia_admin: jaia_admin is a
# person's login whose password the customer may change, and a bind that breaks
# when they do would take support access with it.
# -y rather than -w: a password in argv is readable by every local process
ldapsearch -LLL -o ldif-wrap=no -x -H "${LDAP_URI}" \
           -D "uid=${BIND_ACCOUNT},ou=people,${BASE_DN}" \
           -y <(printf '%s' "${authelia_ldap_password}") \
           -b "ou=people,${BASE_DN}" \
           "(&(uid=${ACCOUNT})(memberOf=cn=${ACCOUNT},ou=groups,${BASE_DN}))" \
           sshPublicKey 2>/dev/null |
while IFS= read -r line; do
    case "$line" in
        "sshPublicKey: "*) key=${line#sshPublicKey: } ;;
        # LDIF base64-encodes a value it cannot write literally
        "sshPublicKey:: "*) key=$(printf '%s' "${line#sshPublicKey:: }" | base64 -d) ;;
        *) continue ;;
    esac

    # An authorized_keys line may carry options, so anything that is not a bare
    # key is dropped rather than handed to sshd to interpret.
    case "$key" in
        ssh-* | ecdsa-* | sk-ssh-* | sk-ecdsa-*) ;;
        *) continue ;;
    esac
    printf '%s\n' "$key" | ssh-keygen -l -f - >/dev/null 2>&1 || continue

    printf '%s\n' "$key"
done
