#!/bin/bash

# Swap file
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# Install script for pulling data from old cloud.jaia.tech (if relevant)
setup_script=/home/jaia/setup_jaia_database.sh
cat <<EOF > ${setup_script}
#!/bin/bash
# Prereqs
# 1. ssh key (ssh -A ...) with access to https://github.com/jaiarobotics/jaia-database
# 2. file '/home/jaia/jaiaparts.sql' exported from prior database

set -e -u

old_db=/home/jaia/jaiaparts.sql
mysql_root_password=$(openssl rand -hex 16)

if [ ! -f "$old_db" ]; then
  echo "$old_db file doesn't exist! Please export it and copy to this machine to use as the starting point for the new DB"
  exit 1
fi

cd /home/jaia
git clone git@github.com:jaiarobotics/jaia-database.git
python3 -m venv venv
. venv/bin/activate
pip install -r jaia-database/requirements.txt

sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${mysql_root_password}';"
sudo mysql_secure_installation --use-default
sudo chown -R jaia /var/lib/mysql
sudo chown -R jaia /var/run/mysqld

mysql -u root -p${mysql_root_password} -e "create database jaiaparts;"
mysql -u root -p${mysql_root_password} jaiaparts < $old_db

cat <<EOFF > ~/my.cnf
[client]
database = jaiaparts
user = root
password = ${mysql_root_password}
default-character-set = utf8
EOFF

Echo "Randomly generated MySQL root password is '${mysql_root_password}'. Please save this somewhere secure (e.g. Bitwarden or similar)"

EOF

chmod a+x ${setup_script}
chown jaia:jaia ${setup_script}

