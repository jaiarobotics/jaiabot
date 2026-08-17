import subprocess


def jaia_bounds(args):
    """Run the standalone 'jaia_bounds' tool (the implementation of 'jaia admin bounds') with the given list of arguments and return the resulting id."""
    return subprocess.run(['jaia_bounds'] + [str(a) for a in args], capture_output=True, text=True, check=True).stdout.strip()


def cloudhub_id():
    return int(jaia_bounds(['--cloudhub_id']))
