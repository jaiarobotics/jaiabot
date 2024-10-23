/**
 * Returns the IP prefix (two octets), corresponding to either the LAN or the VPN access.
 *
 * @param {string} hostname
 * @returns {("172.23" | "10.23")} The IP prefix needed to create proper links to JDV, the router, upgrade, etc.
 */
export function getIPPrefix(hostname: string) {
    // For the VPN
    // Return 172.23 for hostnames matching:
    // * 172.23.x.x
    // * bXfX
    //
    // Return 10.23 for ANYTHING else

    if (hostname.match(/172\.23\.[0-9]+\.[0-9]+/)) return "172.23";
    if (hostname.match(/h[0-9]+f[0-9]+/)) return "172.23";
    return "10.23";
}
