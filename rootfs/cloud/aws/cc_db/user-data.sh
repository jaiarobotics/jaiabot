#!/bin/bash

# Swap file
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# Install script for pulling data from old server (if relevant)
setup_script=/home/jaia/setup_jaia_database.sh
cat <<EOF > ${setup_script}
#!/bin/bash
# Prereqs
# 1. ssh key (ssh -A ...) with access to https://github.com/jaiarobotics/jaia-database
# 2. file '/home/jaia/jaiaparts.sql' exported from prior database ('jaia-database/grab-copy-of-production-db.sh')

set -e -u

old_db=/home/jaia/jaiaparts.sql
mysql_root_password=\$(openssl rand -hex 16)

if [ ! -f "\$old_db" ]; then
  echo "\$old_db file doesn't exist! Please export it and copy to this machine to use as the starting point for the new DB"
  exit 1
fi

cd /opt
sudo chown jaia /opt
git clone git@github.com:jaiarobotics/jaia-database.git 
python3 -m venv venv
. venv/bin/activate
pip install -r jaia-database/requirements.txt

cat << EOFF > mysql_setup.sql
-- Set root password
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '\${mysql_root_password}';

-- Remove anonymous users
DELETE FROM mysql.user WHERE User='';

-- Disallow remote root login
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Remove test database
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- Reload privilege tables
FLUSH PRIVILEGES;

EOFF

sudo mysql -uroot < mysql_setup.sql

mysql -uroot -p\${mysql_root_password} -e "create database jaiaparts;"
mysql -uroot -p\${mysql_root_password} jaiaparts < \$old_db

cat <<EOFF > /opt/my.cnf
[client]
database = jaiaparts
user = root
password = \${mysql_root_password}
default-character-set = utf8
EOFF

DJANGO_SECRET_KEY=\$(
  venv/bin/python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
)

sudo tee /etc/jaia-database-config.json > /dev/null <<EOFF
{
  "SECRET_KEY": "\${DJANGO_SECRET_KEY}",
  "PROD": "True"
}
EOFF


echo "Randomly generated MySQL root password is '\${mysql_root_password}'. Please save this somewhere secure (e.g. Bitwarden or similar)"
EOF

chmod a+x ${setup_script}
chown jaia:jaia ${setup_script}


cat <<EOF > /etc/apache2/sites-available/cc_db.conf
WSGIPythonHome "/opt/venv"

<virtualhost *:80>
    ServerName cc_db
 
    WSGIDaemonProcess db user=jaia group=jaia threads=5 python-home=/opt/venv python-path=/opt/jaia-database/
    WSGIScriptAlias / /opt/jaia-database/jaia-database/wsgi.py process-group=db

    <directory /opt/jaia-database/>
        WSGIApplicationGroup %{GLOBAL}
        WSGIScriptReloading On
        AllowOverride None
        Require all granted
    </directory>

    Alias /static/ /opt/jaia-database/static/

    <directory /opt/jaia-database/static>
        Require all granted
    </directory>

    Alias /media/ /var/www/jaia-database/media/

    <directory /var/www/jaia-database/media>
        Require all granted
    </directory>

    WSGIErrorOverride Off
</virtualhost>

EOF

a2enmod wsgi
a2ensite cc_db
a2dissite 000-default
systemctl restart apache2
