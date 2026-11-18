#!/bin/bash

set -u -e -o pipefail

## This script must be idempotent!!
# Installs and (re)configures Authelia, Caddy, and LLDAP to provide a web-based authentication portal with user management for Cloudhub and friends.

###############
## Constants ##
###############

jaia_auth_lldap_bootstrap_completed=false

set -a
source "/etc/jaiabot/jaia.env"
source "/etc/jaiabot/cloud.env"
set +a

source /usr/share/jaiabot/jaia-authelia-common.sh

## Ports
lldap_ldap_port=3890
lldap_web_port=17170
jcc_port=8080
authelia_port=9991
authelia_address="tcp://:$authelia_port"
support_portal_port=9992
# Fleet pairing's own SSH port: only the bootstrap key, only the enrollment command
pairing_port=2222

## IP/URLs
base_uri=$jaia_auth_base_uri
admin_email=$jaia_auth_admin_email
smtp_address=$jaia_auth_smtp_address
smtp_sender=${jaia_auth_smtp_sender:-noreply@auth.jaia.tech}
# Keep this default in sync with create_vpc.sh
smtp_credentials_parameter=${jaia_auth_smtp_credentials_ssm_parameter:-/jaia/cloudhub/smtp_credentials}

ch_ip=$(jaia_ip --query_type addr --ip_net cloudhub_vpn --fleet_id ${jaia_fleet_id} --node_type hub --node_id $(jaia_bounds --cloudhub_id) --ip_version ipv6)
vh1_ip=$(jaia_ip --query_type addr --ip_net vfleet_vpn --fleet_id ${jaia_fleet_id} --node_type hub --node_id 1 --ip_version ipv6)

# Landing page and shared navigation (static, from jaiabot-web)
jaia_cloud_web_dir=/usr/share/jaiabot/web/cloud

# Persistent directories (between major upgrades)
auth_persistent_dir=/var/log/jaiabot/auth
authelia_persistent_dir=$auth_persistent_dir/authelia
# Not under /etc/authelia: the package's tmpfiles.d rule sets 0640 on everything there, directories included
authelia_asset_dir=$authelia_persistent_dir/assets
authelia_secrets_file=$authelia_persistent_dir/secrets
lldap_persistent_dir=$auth_persistent_dir/lldap
support_persistent_dir=$auth_persistent_dir/support
swapfile=$auth_persistent_dir/swapfile
smtp_password_file=/etc/authelia/smtp_password

jaia_bootstrap_marker=$auth_persistent_dir/jaia_bootstrap_created
jaia_bootstrap_config=/etc/lldap/bootstrap/user-configs/jaia_bootstrap.json

caddy_names=("$base_uri" "auth.$base_uri" "users.$base_uri" "support.$base_uri" "run.$base_uri" "sim.$base_uri")
caddy_wait_for_dns=/etc/systemd/system/caddy.service.d/jaia-wait-for-dns.conf
sshd_pairing_conf=/etc/ssh/sshd_config.d/jaia_pairing.conf


#############
## General ##
#############

# Swapfile (need more RAM to run both Authelia and Apache2/JCC)
setup_swapfile()
{
    mkdir -p "$auth_persistent_dir"
    if [ ! -f $swapfile ]; then
        btrfs filesystem mkswapfile --size 2G $swapfile
        swapon $swapfile
    fi
}

# RFC 2606 and RFC 6761 reserve these names, so this is a CI or bench CloudHub rather than
# one anybody reaches: no public CA can issue for it and there is no mail relay behind it
detect_deployment()
{
    case "$base_uri" in
        *.invalid|*.test|*.example|*.localhost|localhost)
            throwaway_deployment=true
            echo "$base_uri is a reserved domain: serving TLS from Caddy's own CA and not dialling SMTP at startup"
            ;;
        *)
            throwaway_deployment=false
            ;;
    esac

    if $throwaway_deployment; then
        caddy_tls="tls internal"
        # Authelia dials the relay at startup and exits fatally when it cannot connect, which
        # with Restart=on-failure is an endless restart loop and a 502 from Caddy for good
        notifier_startup_check="disable_startup_check: true"
    else
        caddy_tls=""
        notifier_startup_check="disable_startup_check: false"
    fi
}

## Move JCC from port 80 to port 8080
configure_apache()
{
    sed -i -E \
        -e 's/^Listen[[:space:]]+80$/Listen 8080/' \
        /etc/apache2/ports.conf
    sed -i -E \
        -e 's/<VirtualHost[[:space:]]+\*:80>/<VirtualHost *:8080>/I' \
        /etc/apache2/sites-available/jcc.conf

    # Authelia authenticates the REST API's callers; it has no key of its own
    cat <<EOF > /etc/jaiabot/rest_api.pb.cfg
streaming_endpoint {
    hub_id: $jaia_hub_id
    hostname: "::1"
    port: 40000
}
EOF

    systemctl reload apache2
}

install_packages()
{
    # Earlier releases installed Authelia from its own apt repository; jaiabot-web-thirdparty
    # now carries it, Caddy and LLDAP, and is already in a CloudHub's image
    rm -f /etc/apt/sources.list.d/authelia.list /etc/apt/preferences.d/authelia /usr/share/keyrings/authelia-security.gpg

    install_web_thirdparty
}


##############
## Authelia ##
##############

# Secrets for Authelia and LLDAP, made once and kept with the persistent data
load_secrets()
{
    mkdir -p "$authelia_persistent_dir"
    # recursive: this directory outlives the rootfs, and the authelia uid a new image
    # allocates need not be the one that wrote the database before a major upgrade
    chown -R authelia:authelia $authelia_persistent_dir

    load_secrets_file "$authelia_secrets_file"
}

load_cloudhub_smtp_credentials()
{
    if ! load_smtp_credentials; then
        # Not fatal: an IP-allowlisted relay (e.g. Google Workspace) needs no credentials
        echo "WARNING: Could not read SMTP credentials from SSM parameter $smtp_credentials_parameter. Authelia will send without authenticating." >&2
    fi
}

# Portal branding. Authelia serves an override instead of its own file, but
# portal.json keys are the English text, so keys left out still read correctly.
# Authelia rejects a value that drops a placeholder the key has.
write_authelia_assets()
{
    mkdir -p $authelia_asset_dir/locales/en
    cp $jaia_cloud_web_dir/authelia/logo.png $jaia_cloud_web_dir/authelia/favicon.ico $authelia_asset_dir/
    cat <<EOF > $authelia_asset_dir/locales/en/portal.json
{
    "Login - {{authelia}}": "Jaia Cloud Fleet ${jaia_fleet_id} - {{authelia}}"
}
EOF
}

write_authelia_config()
{
    {
        authelia_config_head
        cat <<EOF
    # The navigation menu asks Caddy who is signed in (/_jaia/whoami on every site)
    - domain:
        - '$base_uri'
        - '*.$base_uri'
      resources:
        - '^/_jaia/whoami$'
      policy: two_factor

    # Allow group 'jdv' to access JDV
    - domain: run.$base_uri
      resources:
        - '^/jdv(?:/.*)?$'
      subject:
        - 'group:jdv'
        - 'group:super_admin'
      policy: two_factor

    # Allow group 'jcu_*' to access JCU
    - domain: run.$base_uri
      resources:
        - '^/jcu(?:/.*)?$'
      subject:
        - 'group:jcu_user'
        - 'group:jcu_advanced'
        - 'group:jcu_developer'
        - 'group:super_admin'
      policy: two_factor

    # Block everyone else from JDV, JCU
    - domain: run.$base_uri
      resources:
        - '^/(jcu|jdv)(?:/.*)?$'
      policy: deny

    # Allow users in various 'rest_api' groups to access API with one-factor
    - domain: run.$base_uri
      resources:
        - '^/jaia/v[0-9]+/(status|metadata|task_packets|missions)(?:/.*)?$'
      subject:
        - 'group:rest_api_read'
        - 'group:super_admin'
      policy: one_factor

    - domain: run.$base_uri
      resources:
        - '^/jaia(?:/.*)?$'
      subject:
        - 'group:rest_api_all'
        - 'group:super_admin'
      policy: one_factor

    # Allow other JCC resources to 'run' group
    - domain: run.$base_uri
      subject:
        - 'group:run'
        - 'group:super_admin'
      policy: two_factor

    # Allow all VirtualHub resources to 'sim' group
    - domain: sim.$base_uri
      subject:
        - 'group:sim'
        - 'group:super_admin'
      policy: 'two_factor'

    - domain: users.$base_uri
      policy: 'two_factor'
      subject:
        - 'group:lldap_admin'
        - 'group:super_admin'

    # Whoever administers the directory is who decides on Jaia's access to the fleet
    - domain: support.$base_uri
      policy: 'two_factor'
      subject:
        - 'group:lldap_admin'
        - 'group:super_admin'

    # Landing page listing the sites
    - domain: $base_uri
      policy: 'two_factor'

session:
  secret: '$session_secret'
  inactivity: '15m'
  expiration: '2h'
  cookies:
     - domain: '$base_uri'
       authelia_url: 'https://auth.$base_uri'
       default_redirection_url: 'https://$base_uri/'
EOF
        authelia_config_tail
    } > /etc/authelia/configuration.yml

    systemctl enable authelia
}


###########
## Caddy ##
###########

write_caddyfile()
{
    cat <<EOF > /etc/caddy/Caddyfile
{
        # replace-response plugin (Caddy from jaiabot-web-thirdparty)
        order replace after encode
}

$(caddy_authelia_snippets)

# Shared navigation menu and landing page (static files from jaiabot-web)
(jaia_nav) {
        # Who is signed in, for the menu. forward_auth sets the Remote-* headers
        # and respond runs after it, so these are Authelia's values, not the client's.
        handle /_jaia/whoami {
                import authelia_forward_auth
                header Cache-Control no-store
                header Content-Type "text/plain; charset=utf-8"
                respond <<WHOAMI
{http.request.header.Remote-User}
{http.request.header.Remote-Name}
{http.request.header.Remote-Groups}
WHOAMI 200
        }

        # Whether the VirtualFleet answers (it only runs once started from JCU).
        # Any reply means up; a failed connection is Caddy's own 502.
        handle /_jaia/sim {
                header Cache-Control no-store
                reverse_proxy [$vh1_ip]:80 {
                        method HEAD
                        rewrite /
                        transport http {
                                dial_timeout 2s
                                response_header_timeout 3s
                        }
                        handle_response {
                                respond 204
                        }
                }
        }

        handle /_jaia/fleet {
                header Cache-Control no-cache
                header Content-Type "text/plain; charset=utf-8"
                respond "${jaia_fleet_id}" 200
        }

        # Public (nothing sensitive) so the sign-in page can show the menu too
        handle /_jaia/* {
                root * $jaia_cloud_web_dir
                header Cache-Control no-cache
                file_server
        }
}

# Proxy to an upstream, injecting the navigation into every HTML page
(jaia_nav_proxy) {
        # replace cannot read compressed bodies, so the upstream must send them
        # uncompressed; encode compresses for the client instead
        encode zstd gzip
        replace {
                match {
                        header Content-Type text/html*
                }
                re "(?i)</head>" "<link rel=\"stylesheet\" href=\"/_jaia/nav.css\"><script defer src=\"/_jaia/nav.js\"></script></head>"
        }
        reverse_proxy {args[0]} {
                header_up Accept-Encoding identity
        }
}

# Landing page
$base_uri {
        $caddy_tls
        import jaia_nav
        handle {
                import authelia_forward_auth
                # Never serve a stored copy to someone who has since signed out
                header Cache-Control no-store
                root * $jaia_cloud_web_dir
                encode zstd gzip
                file_server
        }
}

# Authelia Portal.
auth.$base_uri {
        $caddy_tls
        import jaia_nav
        import authelia_portal jaia_nav_proxy localhost:$authelia_port
}

users.$base_uri {
        $caddy_tls
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy :$lldap_web_port
        }
}

# Jaia support access
support.$base_uri {
        $caddy_tls
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy :$support_portal_port
        }
}

# Runtime JCC
run.$base_uri {
        $caddy_tls
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy [$ch_ip]:$jcc_port
        }
}

# VirtualFleet JCC
sim.$base_uri {
        $caddy_tls
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy [$vh1_ip]:80
        }

        # The VirtualFleet is down until started from JCU; say so rather than a blank 502
        handle_errors 502 503 504 {
                @page not path /_jaia/*
                handle @page {
                        root * $jaia_cloud_web_dir
                        rewrite * /_jaia/sim-down.html
                        header Cache-Control no-store
                        file_server
                }
        }
}

EOF

    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
}

# Caddy runs only once its names resolve here (see jaia-caddy-dns-ready.sh), and the
# timer starts it when they do
configure_caddy_dns_wait()
{
    if $throwaway_deployment; then
        rm -f "$caddy_wait_for_dns"
        systemctl disable --now jaia-caddy-start.timer 2>/dev/null || true
        return
    fi
    mkdir -p "$(dirname "$caddy_wait_for_dns")"
    cat <<EOF > "$caddy_wait_for_dns"
[Service]
ExecCondition=+/usr/bin/jaia-caddy-dns-ready.sh ${caddy_names[*]}
EOF
    cat <<EOF > /etc/systemd/system/jaia-caddy-start.service
[Unit]
Description=Start Caddy if its names resolve to this CloudHub

[Service]
Type=oneshot
ExecStart=/bin/systemctl start caddy.service
ExecStartPost=/bin/sh -c 'if systemctl is-active --quiet caddy.service; then systemctl stop --no-block jaia-caddy-start.timer; fi'
EOF
    cat <<EOF > /etc/systemd/system/jaia-caddy-start.timer
[Unit]
Description=Start Caddy once its names resolve to this CloudHub

[Timer]
OnActiveSec=30s
OnUnitInactiveSec=30s
AccuracySec=5s

[Install]
WantedBy=timers.target
EOF
    systemctl enable jaia-caddy-start.timer
}

# Caddy starts with its stock Caddyfile when installed, so reload to apply ours
# (graceful if running). The running process cannot reload into a new binary,
# and a stock binary rejects 'replace', so restart when the binary changed. A
# restart while the names do not resolve leaves it stopped, for the timer.
start_caddy()
{
    systemctl daemon-reload
    systemctl enable caddy

    if $caddy_binary_changed || { ! $throwaway_deployment && ! /usr/bin/jaia-caddy-dns-ready.sh "${caddy_names[@]}"; }; then
        systemctl restart caddy
    else
        systemctl reload-or-restart caddy
    fi
    if ! $throwaway_deployment && ! systemctl is-active --quiet caddy; then
        systemctl start jaia-caddy-start.timer
    fi
}


###########
## LLDAP ##
###########

write_lldap_group_configs()
{
    mkdir -p /etc/lldap/bootstrap/group-configs
    local group
    for group in run sim jcu_user jcu_advanced jcu_developer jdv lldap_admin super_admin \
                 rest_api_read rest_api_all; do
        cat > "/etc/lldap/bootstrap/group-configs/${group}.json" <<EOF
{
  "name": "${group}"
}
EOF
    done
}

write_lldap_user_configs()
{
    mkdir -p /etc/lldap/bootstrap/user-configs

    # No password: bootstrap.sh reapplies every password its user configs carry, so one
    # here would be restored over whatever the admin has since chosen. They set their
    # own through the portal's reset link.
    cat > /etc/lldap/bootstrap/user-configs/fleet_admin.json <<EOF
{
  "id": "fleet_admin",
  "email": "$admin_email",
  "groups": ["super_admin", "lldap_admin"
  ]
}
EOF
    chmod 0600 /etc/lldap/bootstrap/user-configs/fleet_admin.json

    write_jaia_bootstrap_config

    # Groupless, and no "groups" key rather than an empty one, so re-running bootstrap
    # cannot withdraw a grant that is in force. The account exists so the support page
    # has something to move in and out of the web groups, and so the customer has one
    # name to audit; it reaches nothing until a grant puts it somewhere.
    cat > /etc/lldap/bootstrap/user-configs/jaia_support.json <<EOF
{
  "id": "jaia_support",
  "email": "support@jaia.tech",
  "displayName": "Jaia support"
}
EOF
}

# Jaia's account for commissioning: testing the CloudHub and pairing its first fleet,
# deleted from the directory before the CloudHub is shipped. Created only the first
# time this CloudHub bootstraps, which the marker in the persistent directory records:
# bootstrap.sh runs again after a major upgrade - its own record of having run lives in
# cloud.env, on the root filesystem the upgrade replaces - and would otherwise bring a
# deleted account back with super_admin on a fleet the customer already owns. No
# password, as for the administrator; Jaia sets one through the reset link.
write_jaia_bootstrap_config()
{
    local email
    email=$(cat "$auth_persistent_dir/jaia_bootstrap_email" 2>/dev/null || true)
    if $jaia_auth_lldap_bootstrap_completed; then
        mkdir -p "$auth_persistent_dir"
        touch "$jaia_bootstrap_marker"
    fi
    if [ -e "$jaia_bootstrap_marker" ]; then
        rm -f "$jaia_bootstrap_config"
    elif [ -z "$email" ]; then
        # create_cloudhub --bootstrap-email names it; a CloudHub made any other way has no one to send the reset link to
        echo "No jaia_bootstrap email in $auth_persistent_dir/jaia_bootstrap_email: not creating jaia_bootstrap"
        rm -f "$jaia_bootstrap_config"
    else
        cat > "$jaia_bootstrap_config" <<EOF
{
  "id": "jaia_bootstrap",
  "email": "$email",
  "displayName": "Jaia commissioning",
  "groups": ["super_admin", "lldap_admin"
  ]
}
EOF
        chmod 0600 "$jaia_bootstrap_config"
    fi
}

bootstrap_lldap()
{
    if $jaia_auth_lldap_bootstrap_completed; then
        return
    fi
    # bounded because a first boot that never returns leaves the machine without the
    # reboot that mounts overlayroot
    if lldap_bootstrap authelia "$authelia_ldap_password" /etc/lldap/bootstrap; then
        echo "jaia_auth_lldap_bootstrap_completed=true" >> /etc/jaiabot/cloud.env
        mkdir -p "$auth_persistent_dir"
        touch "$jaia_bootstrap_marker"
        rm -f "$jaia_bootstrap_config"
    else
        echo "ERROR: LLDAP bootstrap did not succeed after 120 attempts" >&2
        exit 1
    fi
}


##################
## Pairing port ##
##################

# New bots and hubs enroll in the CloudHub VPN over SSH on a port of their own. Fleet
# pairing opens it to every address, so sshd there reads only the bootstrap key's file
# and runs only the enrollment command: port 22, where Jaia's root keys are read, is
# opened only by a support grant. The first matching block sets a keyword, so the
# narrower one comes first.
configure_pairing_port()
{
    local socket_activated=false
    if systemctl is-enabled --quiet ssh.socket 2>/dev/null; then
        socket_activated=true
    fi

    touch /etc/jaiabot/ssh/pairing_authorized_keys
    chown jaia:jaia /etc/jaiabot/ssh/pairing_authorized_keys
    chmod 600 /etc/jaiabot/ssh/pairing_authorized_keys

    local before
    before=$(cat "$sshd_pairing_conf" /etc/systemd/system/ssh.socket.d/jaia-pairing.conf 2>/dev/null || true)
    cat > "$sshd_pairing_conf.new" <<EOF
Match LocalPort $pairing_port User *,!jaia
    AuthorizedKeysFile none
    AuthorizedPrincipalsFile none
    AuthenticationMethods publickey
    PermitTTY no
    DisableForwarding yes
    ForceCommand /bin/false
Match LocalPort $pairing_port
    AuthorizedKeysFile /etc/jaiabot/ssh/pairing_authorized_keys
    AuthorizedPrincipalsFile none
    AuthenticationMethods publickey
    PermitTTY no
    DisableForwarding yes
    PermitUserRC no
    PermitTunnel no
    ForceCommand /usr/bin/jaia-vpn-enroll.sh
EOF
    if $socket_activated; then
        mkdir -p /etc/systemd/system/ssh.socket.d
        # Both, as Ubuntu's ssh.socket lists 22: with its BindIPv6Only=ipv6-only a bare port
        # would listen on IPv6 alone
        cat > /etc/systemd/system/ssh.socket.d/jaia-pairing.conf <<EOF
[Socket]
ListenStream=0.0.0.0:$pairing_port
ListenStream=[::]:$pairing_port
EOF
    else
        printf 'Port 22\nPort %s\n' "$pairing_port" | cat - "$sshd_pairing_conf.new" > "$sshd_pairing_conf.tmp"
        mv "$sshd_pairing_conf.tmp" "$sshd_pairing_conf.new"
    fi
    mv "$sshd_pairing_conf.new" "$sshd_pairing_conf"
    sshd -t

    if [ "$(cat "$sshd_pairing_conf" /etc/systemd/system/ssh.socket.d/jaia-pairing.conf 2>/dev/null || true)" != "$before" ]; then
        systemctl daemon-reload
        if $socket_activated; then
            systemctl restart ssh.socket
        else
            systemctl reload-or-restart ssh
        fi
    fi
    if ufw status 2>/dev/null | grep -q "^Status: active"; then
        ufw allow in on eth0 to any port $pairing_port proto tcp >/dev/null
    fi
}


####################
## Support portal ##
####################

configure_support_portal()
{
    if [ ! -d "$support_persistent_dir" ]; then
        mkdir -p $support_persistent_dir
        chmod 0700 $support_persistent_dir
    fi

    # The portal's trust root, in the form ssh-keygen -Y verify reads. Derived from
    # the root keys the image already carries rather than from a list kept here, so
    # adding or retiring a Yubikey is the one edit it has always been. Written whole
    # so a request is never checked against a half-written file.
    mkdir -p /etc/jaiabot/support
    awk '$1 ~ /^(ssh|sk-ssh|ecdsa|sk-ecdsa)-/ { print "jaia-support", $1, $2 }' \
        /etc/jaiabot/ssh/root_authorized_keys > /etc/jaiabot/support/allowed_signers.new
    [ -s /etc/jaiabot/support/allowed_signers.new ]
    mv /etc/jaiabot/support/allowed_signers.new /etc/jaiabot/support/allowed_signers

    cat > /etc/systemd/system/jaia_support_portal.service <<EOF
[Unit]
Description=Jaia support access portal

[Service]
ExecStart=/usr/bin/jaia-support-portal.py
Environment=JAIA_FLEET_ID=$jaia_fleet_id
Environment=JAIA_SUPPORT_PORTAL_PORT=$support_portal_port

# Root to drive ufw, and strict confinement would stop that, so only what it
# never writes is made read-only
ProtectSystem=true
PrivateTmp=true

Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

    # A firewall rule has no expiry of its own, so this is the one mechanism that
    # ends a grant nobody remembers to end.
    cat > /etc/systemd/system/jaia_support_reconcile.service <<EOF
[Unit]
Description=Bring Jaia's support access back in line with what the customer granted
# Web access lives in the directory, so a run before it is up has nothing to say;
# the next tick would recover anyway, but not before reporting a failure
After=lldap.service

[Service]
Type=oneshot
ExecStart=/usr/bin/jaia-support-access.py reconcile
Environment=JAIA_FLEET_ID=$jaia_fleet_id
EOF

    cat > /etc/systemd/system/jaia_support_reconcile.timer <<EOF
[Unit]
Description=Bring Jaia's support access back in line with what the customer granted

[Timer]
# On boot as well as on the interval: a grant must not outlive a CloudHub that
# happened to be switched off when it expired
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable jaia_support_portal
    systemctl restart jaia_support_portal
    systemctl enable --now jaia_support_reconcile.timer
}

# HTTP(S) through ufw; the security group is set when the CloudHub is created
open_firewall()
{
    ufw allow in on eth0 to any port 80 proto tcp
    ufw allow in on eth0 to any port 443 proto tcp
}


##########
## Main ##
##########

main()
{
    setup_swapfile
    detect_deployment
    configure_apache
    install_packages

    load_secrets
    # Before anything Authelia reads at startup is rewritten, the SMTP password included
    authelia_inputs_before=$(authelia_inputs_fingerprint)
    load_cloudhub_smtp_credentials
    write_authelia_assets
    write_authelia_config

    write_caddyfile
    configure_caddy_dns_wait
    start_caddy

    write_lldap_group_configs
    write_lldap_user_configs
    start_lldap
    bootstrap_lldap

    start_authelia

    configure_pairing_port
    configure_support_portal
    open_firewall
}

main "$@"
