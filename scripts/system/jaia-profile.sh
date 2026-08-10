# Installed as /etc/profile.d/jaia.sh
#
# Gives interactive shells the identity of this bot/hub, so that the 'jaia' tool
# can resolve host codes without an explicit fleet suffix (e.g. 'jaia ip b4').
#
# /etc/jaiabot/jaia.env is written by the jaiabot-embedded postinst from the
# debconf database. It deliberately carries identity fields only - service
# configuration lives in the generated systemd units, not here.

if [ -r /etc/jaiabot/jaia.env ]; then
    set -a
    . /etc/jaiabot/jaia.env
    set +a
fi

case $- in
    *i*) alias j="jaiabot-status" ;;
esac
