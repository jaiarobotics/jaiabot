#!/bin/bash

# Install Authelia
curl -fsSL https://www.authelia.com/keys/authelia-security.gpg -o /usr/share/keyrings/authelia-security.gpg
echo 'deb [arch='$(dpkg --print-architecture)' signed-by=/usr/share/keyrings/authelia-security.gpg] https://apt.authelia.com stable main' | tee /etc/apt/sources.list.d/authelia.list > /dev/null
apt update && apt install -y authelia

mkdir /var/lib/authelia
chown authelia:authelia /var/lib/authelia

# Authelia configuration
mv /etc/authelia/configuration.yml /etc/authelia/configuration.yml.ex

jwt_secret=$(openssl rand -hex 64)
session_secret=$(openssl rand -hex 64)
storage_encryption_key=$(openssl rand -hex 64)


cat <<EOF > /etc/authelia/configuration.yml
---
default_2fa_method: 'totp'
totp:
  disable: false
  issuer: 'cloud.jaia.tech'
webauthn:
  disable: false
  enable_passkey_login: true
  display_name: 'cloud.jaia.tech'
duo_api:
  disable: true
identity_validation:
  reset_password:
    jwt_secret: '$jwt_secret'
authentication_backend:
  file:
    path: '/var/lib/authelia/users_database.yml'
access_control:
  default_policy: 'deny'
  rules:
    - domain_regex: '^(jdv\.|jcu\.|)(?P<Group>\w+)\.jaia\.gobysoft\.org$'
      policy: 'two_factor'
session:
  secret: '$session_secret'
  cookies:
     -
      domain: 'gobysoft.org'
      authelia_url: 'https://auth.jaia.gobysoft.org'
storage:
  encryption_key: '$storage_encryption_key'
  local:
    path: '/var/lib/authelia/db.sqlite3'
notifier:
  filesystem:
    filename: '/var/lib/authelia/notification.txt'
...
EOF

cat <<EOF > /var/lib/authelia/users_database.yml
# yamllint disable rule:line-length
---
###############################################################
#                         Users Database                      #
###############################################################

# To generate password use 'authelia crypto hash generate argon2'

users:
#  authelia:
#    disabled: false
#    displayname: "Test User"
#    password: ""
#    email: authelia@authelia.com
#    groups:
#      - f1

...
# yamllint enable rule:line-length
EOF


# Enable Authelia service
systemctl enable authelia
systemctl start authelia

# Install reverse proxy caddy
apt install -y caddy

# caddy configuration
cat <<EOF > /etc/caddy/Caddyfile
# Authelia Portal.
auth.jaia.gobysoft.org {
        reverse_proxy localhost:9091
}

# Protected Endpoint.
f1.jaia.gobysoft.org {
        forward_auth localhost:9091 {
                uri /api/authz/forward-auth
                copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
        }

        reverse_proxy [fd0f:77ac:4fdf:1::1e]:80
}

jcu.f1.jaia.gobysoft.org {
        forward_auth localhost:9091 {
                uri /api/authz/forward-auth
                copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
        }

        reverse_proxy [fd0f:77ac:4fdf:1::1e]:9091
}


jdv.f1.jaia.gobysoft.org {
       forward_auth localhost:9091 {
                uri /api/authz/forward-auth
                copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
        }

        reverse_proxy [fd0f:77ac:4fdf:1::1e]:40010
}
EOF

systemctl restart caddy

# Swap file
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
