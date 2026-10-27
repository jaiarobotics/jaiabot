#!/bin/bash
# Copies every account from the auth.cloud.jaia.tech server of 2024-26 (Authelia from apt, LLDAP
# in Docker) to one set up with deploy.sh, so nobody enrolls again, then checks the copy.
#
# The source is only read, unless --final, which stops its Authelia and LLDAP first so that
# nothing changes there after the copy (cutover). Run deploy.sh on the new server first.

set -u -e -o pipefail

final=false
if [ "${1:-}" = "--final" ]; then
    final=true
    shift
fi
if (( $# < 2 || $# > 3 )); then
    echo "Usage: $0 [--final] authelia/authelia.conf old-ssh-host [new-ssh-host]"
    exit 1
fi

SCRIPT_PATH=$(cd "$(dirname "$0")/.." && pwd)
set -a; source "$1"; set +a
old=$2
new=${3:-$SERVER_NAME}
SSH_OPTS=${SSH_OPTS:-}

# Fleet groups from before each CloudHub had its own Authelia
retired_groups="f1 f2 f3"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo ">>>>>> Exporting from $old"
ssh $SSH_OPTS "jaia@$old" "sudo python3 - $final" > "$work/export.tar.gz" <<'EOF'
import io, json, shlex, shutil, sqlite3, subprocess, sys, tarfile, tempfile, yaml

if sys.argv[1] == "true":
    subprocess.run(["systemctl", "stop", "authelia", "lldap"], check=True)

authelia = yaml.safe_load(open("/etc/authelia/configuration.yml"))
compose = yaml.safe_load(open("/etc/lldap/docker-compose.yaml"))
lldap_env = dict(e.split("=", 1) for e in compose["services"]["lldap"]["environment"])

if not authelia["authentication_backend"]["ldap"]["user"].lower().startswith("uid=admin,"):
    sys.exit("Authelia does not bind as admin here, so its password is not the admin's")

# LLDAP takes LLDAP_KEY_SEED over the key_seed in its lldap_config.toml, which differs
secrets = {
    "storage_encryption_key": authelia["storage"]["encryption_key"],
    "lldap_key_seed": lldap_env["LLDAP_KEY_SEED"],
    "lldap_admin_password": authelia["authentication_backend"]["ldap"]["password"],
}

# The copies hold every password hash and TOTP secret, so none outlives this run
out = tempfile.mkdtemp()
def backup(src, name):
    # Read-only: a write-mode open by root could leave files the running service can't write
    source, copy = sqlite3.connect("file:%s?mode=ro" % src, uri=True), sqlite3.connect(out + "/" + name)
    source.backup(copy)
    copy.close()
    source.close()
    return sqlite3.connect(out + "/" + name)

try:
    a = backup("/var/lib/authelia/db.sqlite3", "authelia.sqlite3")
    l = backup("/var/lib/lldap/users.db", "users.db")
    counts = {
        "users": sorted(r[0] for r in l.execute("select user_id from users")),
        "groups": sorted(r[0] for r in l.execute("select display_name from groups")),
        "totp": a.execute("select count(*) from totp_configurations").fetchone()[0],
        "webauthn": a.execute("select count(*) from webauthn_credentials").fetchone()[0],
        "preferences": a.execute("select count(*) from user_preferences").fetchone()[0],
    }

    with tarfile.open(fileobj=sys.stdout.buffer, mode="w|gz") as tar:
        for name in ("authelia.sqlite3", "users.db"):
            tar.add(out + "/" + name, arcname=name)
        for name, text in (("secrets", "".join("%s=%s\n" % (k, shlex.quote(v)) for k, v in secrets.items())),
                           ("counts.json", json.dumps(counts))):
            data = text.encode()
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(data), 0o600
            tar.addfile(info, io.BytesIO(data))
finally:
    shutil.rmtree(out)
EOF
chmod 0600 "$work/export.tar.gz"

echo ">>>>>> Importing into $new"
import=$(cat <<'EOF'
set -e -u -o pipefail
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
tar -C "$tmp" -xzf -
if [ ! -e /etc/jaiabot/auth-server-built ]; then
    echo "$(hostname) was not built as an auth server by create_specialty_server.sh; not importing" >&2
    exit 1
fi
if ! sudo test -x /usr/local/sbin/jaia-auth-server-configure; then
    echo "Run deploy.sh on this server first" >&2
    exit 1
fi
sudo systemctl stop authelia lldap
sudo rm -f /var/lib/authelia/db.sqlite3-* /var/lib/lldap/users.db-*
sudo install -o authelia -g authelia -m 0600 "$tmp/authelia.sqlite3" /var/lib/authelia/db.sqlite3
sudo install -o lldap -g lldap -m 0600 "$tmp/users.db" /var/lib/lldap/users.db
# Only the secrets existing accounts depend on; the rest stay this server's own
while IFS= read -r line; do
    sudo sed -i "/^${line%%=*}=/d" /var/lib/jaia-auth-server/secrets
    echo "$line" | sudo tee -a /var/lib/jaia-auth-server/secrets > /dev/null
done < "$tmp/secrets"
# stdout carries only the counts back
sudo /usr/local/sbin/jaia-auth-server-configure >&2
cat "$tmp/counts.json"
EOF
)
source_counts=$(ssh $SSH_OPTS "jaia@$new" "$import" < "$work/export.tar.gz" | tail -1)

echo ">>>>>> Checking $new"
ssh $SSH_OPTS "jaia@$new" "sudo python3 - '$source_counts' '$retired_groups'" <<'EOF'
import json, sqlite3, subprocess, sys, time, urllib.request

source, retired = json.loads(sys.argv[1]), sys.argv[2].split()
secrets = dict(line.split("=", 1) for line in open("/var/lib/jaia-auth-server/secrets").read().split())
failures = []

def lldap(path, body, token=None):
    req = urllib.request.Request("http://127.0.0.1:17170" + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

# The admin's password only opens with the old key seed
admin_password = secrets["lldap_admin_password"].strip("'")
try:
    token = lldap("/auth/simple/login", {"username": "admin", "password": admin_password})["token"]
    print("OK   admin signs in to LLDAP: the key seed came across")
except Exception as e:
    sys.exit("FAIL admin cannot sign in to LLDAP (%s): wrong key seed or admin password" % e)

groups = lldap("/api/graphql", {"query": "{groups{id displayName}}"}, token)["data"]["groups"]
for group in groups:
    if group["displayName"] in retired:
        lldap("/api/graphql", {"query": "mutation($id:Int!){deleteGroup(groupId:$id){ok}}",
                               "variables": {"id": group["id"]}}, token)
        print("OK   removed retired group %s" % group["displayName"])

authelia = lldap("/api/graphql", {"query": '{user(userId:"authelia"){groups{displayName}}}'}, token)
if "lldap_admin" in [g["displayName"] for g in authelia["data"]["user"]["groups"]]:
    print("OK   authelia is an LLDAP admin")
else:
    failures.append("authelia is not in lldap_admin")

for _ in range(60):
    try:
        with urllib.request.urlopen("http://127.0.0.1:9091/api/health", timeout=2) as r:
            if json.load(r)["status"] == "OK":
                break
    except Exception:
        pass
    time.sleep(1)
else:
    failures.append("Authelia is not healthy")

check = subprocess.run(["sudo", "-u", "authelia", "authelia", "storage", "encryption", "check",
                        "--config", "/etc/authelia/configuration.yml", "--verbose"],
                       capture_output=True, text=True)
print(check.stdout.strip())
if check.returncode != 0 or "FAILURE" in check.stdout:
    failures.append("Authelia's encryption check failed: wrong storage encryption key?")

a = sqlite3.connect("/var/lib/authelia/db.sqlite3")
l = sqlite3.connect("/var/lib/lldap/users.db")
users = sorted(r[0] for r in l.execute("select user_id from users") if r[0] != "authelia")
groups = sorted(r[0] for r in l.execute("select display_name from groups"))
here = {
    "users": users,
    "groups": groups,
    "totp": a.execute("select count(*) from totp_configurations").fetchone()[0],
    "webauthn": a.execute("select count(*) from webauthn_credentials").fetchone()[0],
    "preferences": a.execute("select count(*) from user_preferences").fetchone()[0],
}
expected = dict(source, groups=[g for g in source["groups"] if g not in retired])
for key in ("users", "groups", "totp", "webauthn", "preferences"):
    same = here[key] == expected[key]
    shown = len(here[key]) if isinstance(here[key], list) else here[key]
    print("%s %-11s %s" % ("OK  " if same else "FAIL", key, shown))
    if not same:
        failures.append("%s differ: %s here, %s expected" % (key, here[key], expected[key]))

if failures:
    sys.exit("\n".join("FAIL " + f for f in failures))
print("Migration checked")
EOF
