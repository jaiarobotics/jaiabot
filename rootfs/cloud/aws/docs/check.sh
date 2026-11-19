#!/bin/bash
# Checks the docs site served from an address, by name, as a browser would see it once DNS points there.
# Usage: check.sh ADDRESS   (IPv4, or IPv6 in brackets)

set -u -o pipefail

if (( $# != 1 )); then
    echo "Usage: $0 ADDRESS"
    exit 1
fi
address=$1
names="docs.jaia.tech whatsupdoc.jaia.tech"
failed=0

check()
{
    if [ "$2" = "$3" ]; then
        echo "OK    $1: $2"
    else
        echo "FAIL  $1: got '$2', expected '$3'"
        failed=1
    fi
}

for name in $names; do
    resolve=(--resolve "$name:80:$address" --resolve "$name:443:$address")
    check "http://$name/ redirects" \
          "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 15 "${resolve[@]}" "http://$name/")" \
          "301 https://$name/"
    check "https://$name/" \
          "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${resolve[@]}" "https://$name/")" "200"
    check "https://$name/figures/" \
          "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${resolve[@]}" "https://$name/figures/aws-specialty-server.png")" "200"
    version=$(curl -s --max-time 15 "${resolve[@]}" "https://$name/" | sed -n 's/.*<span id="projectnumber">&#160;\([^<]*\)<.*/\1/p')
    echo "      $name serves jaiabot-doc ${version:-(no version found)}"
done

cert=$(echo | openssl s_client -connect "$address:443" -servername docs.jaia.tech 2>/dev/null | openssl x509 -noout -ext subjectAltName -enddate 2>/dev/null)
for name in $names; do
    check "certificate names $name" "$(grep -o "DNS:$name\b" <<< "$cert")" "DNS:$name"
done
end=$(sed -n 's/notAfter=//p' <<< "$cert")
if [ -n "$end" ] && (( $(date -d "$end" +%s) - $(date +%s) > 14 * 86400 )); then
    echo "OK    certificate valid until $end"
else
    echo "FAIL  certificate expires ${end:-(none served)}"
    failed=1
fi

exit $failed
