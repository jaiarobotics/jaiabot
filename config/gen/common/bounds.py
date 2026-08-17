import functools
import subprocess


def jaia_bounds(args):
    """Run the standalone 'jaia_bounds' tool (the implementation of 'jaia admin bounds') with the given list of arguments and return the resulting id."""
    return subprocess.run(['jaia_bounds'] + [str(a) for a in args], capture_output=True, text=True, check=True).stdout.strip()


def cloudhub_id():
    return int(jaia_bounds(['--cloudhub_id']))


@functools.lru_cache(maxsize=None)
def ipv4_fleet_id_max():
    return int(jaia_bounds(['--ipv4_fleet_id', '--max']))


def is_ipv4_fleet(fleet_id):
    """True for the fleets addressed with IPv4 on the fleet WLAN and fleet VPN; the rest are IPv6 on every network."""
    return int(fleet_id) <= ipv4_fleet_id_max()
