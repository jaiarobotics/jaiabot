# Installed as /etc/profile.d/jaia.sh
#
# Gives shells this bot/hub's identity so the 'jaia' tool can resolve host codes
# without an explicit fleet suffix (e.g. 'jaia ip b4'). jaia.env is written by
# the jaiabot-embedded postinst from debconf.

if [ -r /etc/jaiabot/jaia.env ]; then
    set -a
    . /etc/jaiabot/jaia.env
    set +a
fi

case $- in
    *i*) alias j="jaiabot-status" ;;
esac
