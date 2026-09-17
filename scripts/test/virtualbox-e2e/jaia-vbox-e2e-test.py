#!/usr/bin/env python3
"""End-to-end test of a JaiaBot VirtualBox OVA.

Imports an OVA as a fleet of VirtualBox bots and hubs, boots them, puts the hubs
on a host-only network so the host can reach them, then exercises the REST API
(run the bots through multi-waypoint dive missions) and the web applications (JCC,
JCU, JDV).

Run with --help for the stage list and options.
"""

import argparse
import ipaddress
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

JAIA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
IMPORT_VMS_DIR = os.path.join(JAIA_ROOT, 'rootfs', 'scripts')

sys.path.insert(0, os.path.join(JAIA_ROOT, 'scripts', 'test', 'e2e'))
from jaia_e2e import api as jaia_api
from jaia_e2e import mission as jaia_mission
from jaia_e2e import wait as jaia_wait
from jaia_e2e.api import bot_ids, bot_status
from jaia_e2e.mission import EARTH_RADIUS_M, distance_m, offset_latlon

DEFAULT_OVA_URL_BASE = 'https://jaia-disk-images.s3.us-east-1.amazonaws.com'

STAGES = ['download', 'import', 'hostonly', 'boot', 'network', 'api', 'web', 'shutdown']


class TestFailure(Exception):
    pass


def log(msg):
    print(f'[{time.strftime("%H:%M:%S")}] {msg}', flush=True)


def stage_banner(name):
    log('')
    log(f'===== {name.upper()} =====')


def run(cmd, check=True, capture=True, **kwargs):
    """Run a command given as a list, returning stdout."""
    if capture:
        kwargs.setdefault('stdout', subprocess.PIPE)
        kwargs.setdefault('stderr', subprocess.PIPE)
    proc = subprocess.run(cmd, text=True, **kwargs)
    if check and proc.returncode != 0:
        raise TestFailure(
            f'command failed ({proc.returncode}): {" ".join(shlex.quote(c) for c in cmd)}\n'
            f'{proc.stderr or ""}')
    return (proc.stdout or '') if capture else ''


def vbm(*args, check=True):
    return run(['VBoxManage'] + list(args), check=check)


# ---------------------------------------------------------------------------
# fleet layout
# ---------------------------------------------------------------------------

class Node:
    def __init__(self, node_type, node_id):
        self.type = node_type
        self.id = node_id
        self.name = f'{node_type}{node_id}'
        self.uuid = None
        self.ssh_port = None
        self.hostonly_ip = None
        self.ssh_error = ''

    def __repr__(self):
        return f'<{self.name} uuid={self.uuid} ssh_port={self.ssh_port}>'


def group_name(ova_path):
    """The VirtualBox group import_vms.sh puts this OVA's VMs in."""
    base = os.path.basename(ova_path)
    stem = base[:-len('.ova')] if base.endswith('.ova') else base
    return '/' + re.sub(r'[+~.]', '_', stem)


def ova_commit(ova):
    """The commit an OVA was built from, from the +g<commit> in its version suffix."""
    m = re.search(r'\+g([0-9a-f]{7,40})\.ova$', os.path.basename(ova))
    return m.group(1) if m else None


def tool_commit():
    """The commit and branch `jaia` reports itself as built from."""
    out = run(['jaia', 'version'], check=False)
    sha = re.search(r'^\s*git hash:\s*([0-9a-f]{7,40})(-dirty)?\s*$', out, re.M)
    branch = re.search(r'^\s*git branch:\s*(\S+)\s*$', out, re.M)
    dirty = bool(sha and sha.group(2))
    return (sha.group(1) if sha else None,
            branch.group(1) if branch and branch.group(1) else None, dirty)


def check_tools_match_ova(args, ova):
    """Refuse tooling built from a different commit than the OVA under test.

    import_vms.sh generates every node's first-boot configuration with the `jaia` on
    PATH. Tooling from another branch writes answers the image's packages no longer
    accept, which surfaces much later as a node that fails to configure itself.
    """
    expected = ova_commit(ova)
    sha, branch, dirty = tool_commit()
    log(f'jaia: {shutil.which("jaia")}, built from {sha or "an unknown commit"}'
        + (f' on {branch}' if branch else '')
        + (' (tree was dirty)' if dirty else ''))
    if not expected:
        log(f'{os.path.basename(ova)} carries no +g<commit>, so the tooling cannot be '
            'checked against it')
        return
    if sha and sha.startswith(expected):
        return

    complaint = (f'the jaia tooling on PATH was built from {sha or "an unknown commit"}'
                 + (f' on branch {branch}' if branch else '')
                 + f', but this OVA was built from {expected}')
    if args.allow_tool_mismatch:
        log(f'WARNING: {complaint}; importing anyway as asked')
    else:
        raise TestFailure(
            complaint + '. import_vms.sh generates each node\'s first-boot '
            'configuration with that tooling, so the fleet would not be configured the '
            'way this image expects. Build this tree at the OVA\'s commit, or pass '
            '--allow-tool-mismatch.')


def jaia_ip(*args):
    """Query the addressing scheme, using a build tree's jaia_ip if one is on PATH."""
    return run(['jaia_ip'] + list(args)).strip()


# ---------------------------------------------------------------------------
# VirtualBox inventory
# ---------------------------------------------------------------------------

def registered_vms():
    """Every registered VM as (name, uuid, group, natnet), natnet from NIC 2."""
    vms = []
    for line in vbm('list', 'vms').splitlines():
        m = re.match(r'^"(.*)" \{(.*)\}$', line.strip())
        if not m:
            continue
        name, uuid = m.group(1), m.group(2)
        info = vbm('showvminfo', '--machinereadable', uuid, check=False)
        group = re.search(r'^groups="(.*)"$', info, re.M)
        natnet = re.search(r'^nat-network2="(.*)"$', info, re.M)
        vms.append((name, uuid, group.group(1) if group else '',
                    natnet.group(1) if natnet else ''))
    return vms


def vms_in_group(group):
    """Map of VM name -> uuid for every VM registered in `group`."""
    return {name: uuid for name, uuid, g, _ in registered_vms() if g == group}


def stale_fleet_vms(group, natnet, names):
    """Same-named nodes of this fleet left behind by an earlier OVA.

    Importing a newer OVA of the same branch lands in its own group, so these do
    not clash by name, but re-creating the NAT network below strands them - their
    NIC 2 is left pointing at a network that no longer holds their address.
    """
    return {name: (uuid, g) for name, uuid, g, n in registered_vms()
            if name in names and g != group and n == natnet}


def vm_state(uuid):
    for line in vbm('showvminfo', '--machinereadable', uuid).splitlines():
        if line.startswith('VMState='):
            return line.split('=', 1)[1].strip('"')
    return 'unknown'


def natnet_port_forwards(natnet):
    """Map of VM name -> forwarded host SSH port, read back from the NAT network."""
    out = vbm('natnetwork', 'list', natnet)
    ports = {}
    for line in out.splitlines():
        m = re.search(r'ssh (\S+):tcp:\[[^\]]*\]:(\d+):', line.strip())
        if m:
            ports[m.group(1)] = int(m.group(2))
    return ports


# ---------------------------------------------------------------------------
# stages
# ---------------------------------------------------------------------------

def stage_download(args):
    stage_banner('download')
    if args.ova:
        if not os.path.exists(args.ova):
            raise TestFailure(f'--ova {args.ova} does not exist')
        log(f'using local OVA {args.ova}')
        return args.ova

    url = args.ova_url
    name = urllib.parse.unquote(os.path.basename(urllib.parse.urlparse(url).path))
    os.makedirs(args.cache_dir, exist_ok=True)
    dest = os.path.join(args.cache_dir, name)
    partial = dest + '.part'

    with urllib.request.urlopen(urllib.request.Request(url, method='HEAD')) as resp:
        expected = int(resp.headers['Content-Length'])

    if os.path.exists(dest) and os.path.getsize(dest) == expected:
        log(f'{dest} already downloaded ({expected} bytes)')
        return dest

    log(f'downloading {url} -> {dest} ({expected} bytes)')
    run(['curl', '-fL', '--retry', '5', '--retry-delay', '5', '-C', '-', '-o', partial, url],
        capture=False)
    got = os.path.getsize(partial)
    if got != expected:
        raise TestFailure(f'downloaded {got} bytes, expected {expected}')
    os.replace(partial, dest)
    log(f'downloaded {dest}')
    return dest


def stage_import(args, ova, nodes):
    stage_banner('import')
    group = group_name(ova)
    log(f'VirtualBox group: {group}')
    check_tools_match_ova(args, ova)

    names = [n.name for n in nodes]
    existing = vms_in_group(group)
    # keyed by uuid: the same node name exists in both groups once an earlier OVA
    # of this fleet is still around
    doomed = {uuid: name for name, uuid in existing.items() if name in names}
    if doomed:
        log(f'these VMs already exist in {group}: {", ".join(sorted(doomed.values()))}')

    stale = stale_fleet_vms(group, natnet_name(args.fleet), names)
    if stale:
        log(f'these VMs are fleet {args.fleet} nodes from an earlier OVA, and '
            f'importing this one strands them:')
        for name, (uuid, g) in sorted(stale.items()):
            log(f'  {name} in {g}')
            doomed[uuid] = name

    if doomed:
        if not args.yes:
            answer = input('Delete and re-import them? [y/N] ').strip().lower()
            if answer not in ('y', 'yes'):
                raise TestFailure('existing VMs left in place; aborting')
        for uuid, name in sorted(doomed.items(), key=lambda kv: kv[1]):
            if vm_state(uuid) != 'poweroff':
                log(f'powering off {name}')
                vbm('controlvm', uuid, 'poweroff', check=False)
                wait_for(lambda u=uuid: vm_state(u) == 'poweroff', 60,
                         f'{name} to power off')
            log(f'deleting {name} ({uuid})')
            vbm('unregistervm', uuid, '--delete')

    bots = ','.join(str(n.id) for n in nodes if n.type == 'bot')
    hubs = ','.join(str(n.id) for n in nodes if n.type == 'hub')
    log(f'importing bots [{bots}] hubs [{hubs}] as fleet {args.fleet}')
    run(['./import_vms.sh', ova, bots, hubs, str(args.fleet)],
        cwd=IMPORT_VMS_DIR, capture=False)

    resolve_nodes(args, ova, nodes)
    return group


def resolve_nodes(args, ova, nodes):
    """Fill in each node's VM uuid and forwarded host SSH port."""
    group = group_name(ova)
    existing = vms_in_group(group)
    ports = natnet_port_forwards(natnet_name(args.fleet))
    for node in nodes:
        if node.name not in existing:
            raise TestFailure(f'{node.name} is not registered in group {group}')
        node.uuid = existing[node.name]
        if node.name not in ports:
            raise TestFailure(f'no ssh port forward for {node.name} on '
                              f'{natnet_name(args.fleet)}')
        node.ssh_port = ports[node.name]
        if node.type == 'hub':
            node.hostonly_ip = str(args.hostonly_base + node.id)
    log('fleet: ' + ', '.join(
        f'{n.name} (ssh 127.0.0.1:{n.ssh_port}'
        + (f', host-only {n.hostonly_ip}' if n.hostonly_ip else '') + ')'
        for n in nodes))


def natnet_name(fleet):
    return 'jaiafleet%02d' % fleet


def stage_hostonly(args, nodes):
    """Give each hub a host-only adapter on NIC 1 so the host can reach it."""
    stage_banner('hostonly')
    ensure_hostonly_if(args)
    for node in nodes:
        if node.type != 'hub':
            continue
        if vm_state(node.uuid) != 'poweroff':
            raise TestFailure(f'{node.name} must be powered off to change NIC 1')
        log(f'{node.name}: NIC 1 -> host-only {args.hostonly_if}')
        vbm('modifyvm', node.uuid,
            '--nic1', 'hostonly', '--host-only-adapter1', args.hostonly_if,
            '--cable-connected1', 'on')


def ensure_hostonly_if(args):
    out = vbm('list', 'hostonlyifs')
    names = re.findall(r'^Name:\s+(\S+)', out, re.M)
    if args.hostonly_if not in names:
        log(f'creating host-only interface {args.hostonly_if}')
        created = vbm('hostonlyif', 'create')
        m = re.search(r"Interface '(\S+)' was successfully created", created)
        if not m or m.group(1) != args.hostonly_if:
            raise TestFailure(
                f'created host-only interface {m.group(1) if m else "?"}, '
                f'but {args.hostonly_if} was requested')
    host_ip = str(args.hostonly_net.network_address + 1)
    log(f'{args.hostonly_if}: host address {host_ip}/{args.hostonly_net.prefixlen}')
    vbm('hostonlyif', 'ipconfig', args.hostonly_if,
        '--ip', host_ip, '--netmask', str(args.hostonly_net.netmask))


def stage_boot(args, nodes):
    stage_banner('boot')
    for node in nodes:
        state = vm_state(node.uuid)
        if state == 'running':
            log(f'{node.name} already running')
            continue
        log(f'starting {node.name} ({args.vm_type})')
        start_vm(args, node)

    for node in nodes:
        wait_for(lambda n=node: ssh_ok(args, n), args.boot_timeout,
                 f'ssh to {node.name} on port {node.ssh_port}',
                 progress=lambda n=node: n.ssh_error or 'no answer')
        log(f'{node.name}: ssh up, waiting for first boot to finish')
        wait_for(lambda n=node: booted_since_first_boot(args, n), args.boot_timeout,
                 f'{node.name} to reboot after its first boot')
        report_cloud_init(args, node)


def report_cloud_init(args, node):
    # --wait prints progress dots ahead of the JSON
    out = ssh(args, node, 'cloud-init status --wait --format json', check=False)
    try:
        status = json.loads(out[out.index('{'):])
    except ValueError:
        log(f'{node.name}: cloud-init status unreadable: {out.strip()[-200:]!r}')
        return
    log(f'{node.name}: cloud-init {status.get("status")}')
    # each stage repeats the errors that carried over from an earlier one
    for error in dict.fromkeys(status.get('errors', [])):
        log(f'  error: {error}')
    # recoverable errors leave cloud-init "degraded done" but did not stop it; the
    # image masks systemd-networkd-wait-online, so cloud-init always reports one
    recovered = [' '.join(message.split())
                 for messages in status.get('recoverable_errors', {}).values()
                 for message in messages]
    for message in dict.fromkeys(recovered):
        log(f'  recovered: {message}')


# cloud-init's first boot installs jaiabot-embedded, stamps the image version file and
# reboots. Waiting for ssh alone lands on the boot that is about to reboot underneath us.
# The journal lives on the persistent log partition, so counting boots says whether that
# reboot has happened without trusting a clock that timesyncd corrects part way through.
FIRST_BOOT_DONE = r'''
grep -q '^JAIABOT_FIRST_BOOT_DATE=' /etc/jaiabot/version || exit 1
[ "$(journalctl --list-boots -q --no-pager | wc -l)" -ge 2 ]
'''


def booted_since_first_boot(args, node):
    return subprocess.run(ssh_args(args, node) + [FIRST_BOOT_DONE],
                          stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0


def start_vm(args, node):
    """Start a VM, waiting out a medium the importer has not let go of yet.

    import_vms.sh writes each node's preseed through vboximg-mount and releases it
    with a lazy unmount, so the last VM imported can still have its disk held for a
    few seconds after the import returns.
    """
    deadline = time.time() + args.start_timeout
    while True:
        proc = subprocess.run(['VBoxManage', 'startvm', node.uuid, '--type', args.vm_type],
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode == 0:
            return
        if 'Locking of attached media failed' not in proc.stderr or time.time() > deadline:
            raise TestFailure(f'could not start {node.name}: {proc.stderr.strip()}')
        log(f'  {node.name}: disk still held by the importer, retrying')
        time.sleep(5)


def stage_network(args, nodes):
    """Point each hub's eth0 at its host-only address and reload networkd."""
    stage_banner('network')
    for node in nodes:
        if node.type != 'hub':
            continue
        cidr = f'{node.hostonly_ip}/{args.hostonly_net.prefixlen}'
        log(f'{node.name}: jaia_network_eth_address={cidr}')
        ssh(args, node,
            'sudo sed -i '
            f'"s|^jaia_network_eth_address=.*|jaia_network_eth_address=\\"{cidr}\\"|" '
            '/etc/jaiabot/network.env')
        written = ssh(args, node,
                      'grep ^jaia_network_eth_address= /etc/jaiabot/network.env').strip()
        if cidr not in written:
            raise TestFailure(f'{node.name}: network.env not updated (got {written})')
        ssh(args, node, 'sudo /usr/bin/jaia-update-network.sh')
        ssh(args, node, 'sudo networkctl reload')
        ssh(args, node, 'sudo networkctl up eth0', check=False)

    for node in nodes:
        if node.type != 'hub':
            continue
        wait_for(lambda n=node: host_can_reach(n.hostonly_ip, 22, timeout=2),
                 args.network_timeout,
                 f'{node.name} to answer on {node.hostonly_ip}')
        log(f'{node.name}: reachable at {node.hostonly_ip}')


def stage_api(args, nodes):
    stage_banner('api')
    hubs = [n for n in nodes if n.type == 'hub']
    bots = [n for n in nodes if n.type == 'bot']

    for hub in hubs:
        log(f'{hub.name}: waiting for the REST API on http://{hub.hostonly_ip}/jaia/v1')
        wait_for(lambda h=hub: api_status(args, h) is not None, args.api_timeout,
                 f'REST API on {hub.name}',
                 progress=lambda: api_status.last_error)
        status = api_status(args, hub)
        reported = sorted(b['bot_id'] for b in status.get('bots', []))
        log(f'{hub.name}: REST API up, bots reporting: {reported}')

    hub = hubs[0]
    log(f'{hub.name}: waiting for all of {[b.id for b in bots]} to report status')
    wait_for(lambda: all(b.id in bot_ids(api_status(args, hub)) for b in bots),
             args.api_timeout, 'every bot to report status to the hub')

    mission_bots = args.mission_bots or [b.id for b in bots]
    unknown = sorted(set(mission_bots) - {b.id for b in bots})
    if unknown:
        raise TestFailure(f'--mission-bots {unknown} are not in the fleet')
    run_dive_missions(args, hub, mission_bots)


class DiveMission:
    def __init__(self, bot_id, waypoints, earlier_packets):
        self.bot_id = bot_id
        self.waypoints = waypoints
        self.earlier_packets = earlier_packets
        self.state, self.goal, self.distance = '', None, float('nan')
        self.dive_count, self.missing = 0, list(range(1, len(waypoints) + 1))

    def summary(self):
        return (f'bot {self.bot_id} {self.state or "(no state)"}, goal {self.goal}, '
                f'{self.distance:.1f} m from its last waypoint')


def run_dive_missions(args, hub, bot_ids):
    log(f'commanding bots {bot_ids} via {hub.name} to each dive at {args.waypoints} waypoints')

    starts = {bot_id: activate_bot(args, hub, bot_id) for bot_id in bot_ids}

    # every mission is laid out from the first bot so they sit side by side whatever
    # the others' starting positions; the simulator places each bot on its first goal
    # when the mission starts, so only the legs after that one show it transiting
    first = starts[bot_ids[0]]['location']
    reference = (first['lat'], first['lon'])
    missions = []
    for n, bot_id in enumerate(bot_ids):
        north = args.waypoint_north - n * args.mission_separation
        waypoints = [offset_latlon(reference, north,
                                   args.waypoint_east + i * args.waypoint_spacing)
                     for i in range(args.waypoints)]
        log(f'bot {bot_id}: {len(waypoints)} waypoints {args.waypoint_spacing} m apart '
            f'heading east from {waypoints[0][0]:.6f},{waypoints[0][1]:.6f} '
            f'({north} m N, {args.waypoint_east} m E of bot {bot_ids[0]})')
        missions.append(DiveMission(bot_id, waypoints, existing_task_packets(args, hub, bot_id)))

    for mission in missions:
        api_command(args, hub, mission.bot_id, dive_mission_plan(args, mission.waypoints))

    def all_underway():
        status = api_status(args, hub)
        return all((bot_status(status, m.bot_id) or {}).get('mission_state', '')
                   .startswith('IN_MISSION__') for m in missions)

    wait_for(all_underway, args.api_timeout, 'every bot to start its mission')
    log(f'bots {bot_ids} underway')

    def all_recovered():
        status = api_status(args, hub)
        if status is None:
            return False
        return all([mission_progress(args, m, bot_status(status, m.bot_id))
                    for m in missions])

    try:
        wait_for(all_recovered, args.mission_timeout,
                 'every bot to work through its waypoints and enter recovery',
                 progress=lambda: '; '.join(m.summary() for m in missions))
    except TestFailure as e:
        raise TestFailure(f'{e}: ' + '; '.join(m.summary() for m in missions)
                          + f' (tolerance {args.waypoint_tolerance} m)')
    for mission in missions:
        log(f'bot {mission.bot_id} in {mission.state}, '
            f'{mission.distance:.1f} m from its last waypoint')

    # recovering at the last waypoint does not show a dive was done at every one, so
    # match the dive task packets each bot sent back against its waypoints
    try:
        wait_for(lambda: all([not m.missing or dives_reported(args, hub, m)
                              for m in missions]),
                 args.api_timeout, 'every bot to report a completed dive at each waypoint',
                 progress=lambda: '; '.join(
                     f'bot {m.bot_id} {m.dive_count} dive packets, waypoints without a '
                     f'dive: {m.missing}' for m in missions if m.missing))
    except TestFailure as e:
        raise TestFailure(
            f'{e}: ' + '; '.join(
                f'bot {m.bot_id} sent {m.dive_count} dive task packets, none reaching '
                f'{args.dive_depth - DIVE_DEPTH_TOLERANCE_M:.1f} m within '
                f'{args.waypoint_tolerance} m of waypoints {m.missing}'
                for m in missions if m.missing)
            + f' ({api_task_packets.last_error or "API answering"})')

    for mission in missions:
        log(f'bot {mission.bot_id} completed a dive at each of its '
            f'{len(mission.waypoints)} waypoints ({mission.dive_count} dive task packets)')


def activate_bot(args, hub, bot_id):
    """Brings a bot to PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN, returning the status it
    reported before being activated."""
    # ACTIVATE is only accepted from IDLE or FAILED, so wait for the bot to settle
    # out of STARTING_UP/SELF_TEST rather than command it mid self test
    ready_states = ('PRE_DEPLOYMENT__IDLE', 'PRE_DEPLOYMENT__FAILED',
                    'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN', 'PRE_DEPLOYMENT__READY')

    def commandable():
        commandable.state = (bot_status(api_status(args, hub), bot_id) or {}) \
            .get('mission_state', '')
        return commandable.state in ready_states

    commandable.state = ''
    wait_for(commandable, args.api_timeout,
             f'bot {bot_id} to reach a state that accepts commands',
             progress=lambda: commandable.state or api_status.last_error)

    start = bot_status(api_status(args, hub), bot_id)
    if not start or 'location' not in start:
        raise TestFailure(f'bot {bot_id} has no location: {start}')

    state = start.get('mission_state')
    if state != 'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN':
        log(f'bot {bot_id} is {state}; sending ACTIVATE')
        api_command(args, hub, bot_id, {'type': 'ACTIVATE'})
        wait_for(lambda: (bot_status(api_status(args, hub), bot_id) or {})
                 .get('mission_state') == 'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN',
                 args.api_timeout, f'bot {bot_id} to finish its self test')
    return start


def dive_mission_plan(args, waypoints):
    task = jaia_mission.dive_task(max_depth=args.dive_depth, depth_interval=args.dive_depth,
                                  hold_time=0, drift_time=0)
    return jaia_mission.dive_mission_plan(waypoints, task, 'vbox-e2e-test')


def mission_progress(args, mission, bot):
    """Logs each change in a bot's mission state; True once it is recovering at its
    last waypoint."""
    state = (bot or {}).get('mission_state', '')
    if not state:
        return False
    goal = bot.get('active_goal')
    if (state, goal) != (mission.state, mission.goal):
        mission.state, mission.goal = state, goal
        log(f'  bot {mission.bot_id}: {state}'
            + (f' (goal {goal} of {len(mission.waypoints)})' if goal else ''))
    if state == 'IN_MISSION__UNDERWAY__ABORT' or not state.startswith('IN_MISSION__'):
        raise TestFailure(f'bot {mission.bot_id} left the mission early')
    loc = bot.get('location')
    if not loc:
        return False
    mission.distance = distance_m((loc['lat'], loc['lon']), mission.waypoints[-1])
    return (state.startswith('IN_MISSION__UNDERWAY__RECOVERY')
            and mission.distance <= args.waypoint_tolerance)


def dives_reported(args, hub, mission):
    packets = api_task_packets(args, hub, mission.bot_id)
    if packets is None:
        return False
    dives = [p['dive'] for p in packets
             if p.get('type') == 'DIVE' and 'dive' in p
             and task_packet_key(p) not in mission.earlier_packets]
    mission.dive_count = len(dives)
    mission.missing = [
        n for n, waypoint in enumerate(mission.waypoints, 1)
        if not any(dive_completed_at(args, dive, waypoint) for dive in dives)]
    return not mission.missing


def existing_task_packets(args, hub, bot_id):
    """Keys of the task packets a bot has already sent, so a mission counts only its own.

    Simulated bots stamp task packets with the simulator's accelerated clock, so a start
    time cannot tell this mission's packets from an earlier run's.
    """
    def fetch():
        fetch.packets = api_task_packets(args, hub, bot_id)
        return fetch.packets is not None

    wait_for(fetch, args.api_timeout, f'bot {bot_id} task packets from {hub.name}',
             progress=lambda: api_task_packets.last_error)
    return {task_packet_key(p) for p in fetch.packets}


def task_packet_key(packet):
    return (packet.get('type'), packet.get('start_time'), packet.get('end_time'))


DIVE_DEPTH_TOLERANCE_M = 1.0


def dive_completed_at(args, dive, waypoint):
    loc = dive.get('start_location')
    return (loc is not None
            and distance_m((loc['lat'], loc['lon']), waypoint) <= args.waypoint_tolerance
            and dive.get('depth_achieved', 0) >= args.dive_depth - DIVE_DEPTH_TOLERANCE_M)


def stage_web(args, nodes):
    stage_banner('web')
    checks = [
        ('JCC', '/', ['jaia command &amp; control', 'jaia command & control']),
        # the liaison is a Wt app and fills its own <title> in from script
        ('JCU', '/jcu/', ['wtd=']),
        ('JDV', '/jdv/', ['jdv - jaiabot data vision']),
    ]
    for node in nodes:
        if node.type != 'hub':
            continue
        for label, path, needles in checks:
            url = f'http://{node.hostonly_ip}{path}'

            def served(u=url):
                served.status, served.body = jaia_api.fetch_page(u)
                return served.status == 200

            served.status, served.body = 0, ''
            wait_for(served, args.web_timeout, f'{label} on {node.name} ({url})',
                     progress=lambda: f'HTTP {served.status}: {served.body[:100]}')
            lowered = served.body.lower()
            if not any(n.lower() in lowered for n in needles):
                raise TestFailure(
                    f'{label} on {node.name} returned {served.status} but the body does '
                    f'not look like a web app: {served.body[:200]!r}')
            log(f'{node.name}: {label} OK at {url} '
                f'({served.status}, {len(served.body)} bytes)')


def stage_shutdown(args, nodes):
    stage_banner('shutdown')
    for node in nodes:
        if vm_state(node.uuid) == 'poweroff':
            log(f'{node.name} already powered off')
            continue
        log(f'{node.name}: ACPI power button')
        vbm('controlvm', node.uuid, 'acpipowerbutton', check=False)
    for node in nodes:
        try:
            wait_for(lambda n=node: vm_state(n.uuid) == 'poweroff',
                     args.shutdown_timeout, f'{node.name} to power off')
        except TestFailure:
            log(f'{node.name} did not shut down cleanly; forcing power off')
            vbm('controlvm', node.uuid, 'poweroff', check=False)
            wait_for(lambda n=node: vm_state(n.uuid) == 'poweroff', 60,
                     f'{node.name} to power off')
        log(f'{node.name}: powered off')


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def wait_for(predicate, timeout, what, interval=5, progress=None):
    jaia_wait.wait_for(predicate, timeout, what, interval, progress, log=log,
                       report_every=30, failure=TestFailure)


def ssh_args(args, node):
    return [
        'ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR', '-o', 'ConnectTimeout=5',
        '-o', 'BatchMode=yes', '-i', args.ssh_key,
        '-p', str(node.ssh_port), 'jaia@127.0.0.1',
    ]


def ssh(args, node, command, check=True):
    return run(ssh_args(args, node) + [command], check=check)


def ssh_ok(args, node):
    proc = subprocess.run(ssh_args(args, node) + ['true'], text=True,
                          stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    lines = proc.stderr.strip().splitlines()
    node.ssh_error = lines[-1] if lines else ''
    return proc.returncode == 0


def check_ssh_key_usable(args):
    """ssh runs with BatchMode, which has no way to ask for a passphrase.

    Without this the key silently fails to sign every time and the boot stage waits
    out its whole timeout on hosts that would let a human straight in.
    """
    if subprocess.run(['ssh-keygen', '-y', '-P', '', '-f', args.ssh_key],
                      stdout=subprocess.DEVNULL,
                      stderr=subprocess.DEVNULL).returncode == 0:
        return
    fingerprint = run(['ssh-keygen', '-lf', args.ssh_key], check=False).split()
    if len(fingerprint) > 1 and fingerprint[1] in run(['ssh-add', '-l'], check=False):
        return
    raise TestFailure(
        f'{args.ssh_key} is passphrase protected and is not loaded in ssh-agent, so '
        f'the unattended ssh this test uses can never authenticate with it.\n'
        f'Run `ssh-add {args.ssh_key}` and try again.')


def host_can_reach(ip, port, timeout=2):
    import socket
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except OSError:
        return False


def hub_api(args, hub):
    """The shared REST client for a hub, one per address."""
    if hub.hostonly_ip not in hub_api.clients:
        hub_api.clients[hub.hostonly_ip] = jaia_api.HubApi(
            f'http://{hub.hostonly_ip}')
    return hub_api.clients[hub.hostonly_ip]


hub_api.clients = {}


def api_status(args, hub):
    """Bot/hub statuses from a hub, or None while the API is not answering yet."""
    client = hub_api(args, hub)
    status = client.status()
    api_status.last_error = client.last_error
    return status


api_status.last_error = ''


def api_command(args, hub, bot_id, command):
    try:
        response = hub_api(args, hub).command(bot_id, command)
    except jaia_api.ApiError as e:
        raise TestFailure(str(e))
    log(f'  sent {command["type"]} to bot {bot_id}')
    return response


def api_task_packets(args, hub, bot_id):
    """The latest task packets a bot has sent, or None while the API is not answering."""
    client = hub_api(args, hub)
    packets = client.task_packets(f'b{bot_id}')
    api_task_packets.last_error = client.last_error
    return packets


api_task_packets.last_error = ''


# ---------------------------------------------------------------------------

def parse_args(argv):
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    src = p.add_mutually_exclusive_group()
    src.add_argument('--ova-url', help='OVA to download and test')
    src.add_argument('--ova', help='OVA already on disk, skipping the download stage')
    p.add_argument('--cache-dir', default=os.path.expanduser('~/jaia-ova-cache'),
                   help='where downloaded OVAs are kept (default: %(default)s)')
    p.add_argument('--fleet', type=int, default=300, help='fleet id (default: %(default)s)')
    p.add_argument('--bots', default='1,2',
                   help='comma separated bot ids (default: %(default)s)')
    p.add_argument('--hubs', default='1,2',
                   help='comma separated hub ids (default: %(default)s)')
    p.add_argument('--hostonly-if', default='vboxnet0',
                   help='host-only interface for the hubs (default: %(default)s)')
    p.add_argument('--hostonly-net', default='192.168.56.0/24',
                   help='host-only network; hub N gets host address .(10+N) '
                        '(default: %(default)s)')
    p.add_argument('--ssh-key', default=os.path.expanduser('~/.ssh/id_rsa'),
                   help='private key matching a public key in ~/.ssh (default: %(default)s)')
    p.add_argument('--vm-type', default='headless', choices=['headless', 'gui', 'separate'],
                   help='how to start the VMs (default: %(default)s)')
    p.add_argument('--mission-bots',
                   help='comma separated bots to run dive missions, all at once '
                        '(default: every bot in --bots)')
    p.add_argument('--mission-separation', type=float, default=500.0,
                   help='distance each mission is laid out south of the previous one, in '
                        'metres (default: %(default)s)')
    p.add_argument('--waypoints', type=int, default=10,
                   help='number of waypoints in each mission, each with a dive '
                        '(default: %(default)s)')
    p.add_argument('--waypoint-spacing', type=float, default=60.0,
                   help='distance between successive waypoints, heading east, in metres '
                        '(default: %(default)s)')
    p.add_argument('--waypoint-north', type=float, default=150.0,
                   help='first waypoint of the first mission, north of the first mission '
                        'bot, in metres (default: %(default)s)')
    # the simulator starts the bots on land, so put the missions out on the water
    p.add_argument('--waypoint-east', type=float, default=-850.0,
                   help='first waypoint of the first mission, east of the first mission '
                        'bot, in metres (default: %(default)s)')
    p.add_argument('--waypoint-tolerance', type=float, default=25.0,
                   help='how close counts as at a waypoint, in metres (default: %(default)s)')
    p.add_argument('--dive-depth', type=float, default=3.0,
                   help='depth of each dive, in metres; the simulated seafloor is '
                        '5-9 m (default: %(default)s)')
    p.add_argument('--stages', default=','.join(STAGES),
                   help=f'comma separated subset of: {",".join(STAGES)}')
    p.add_argument('--yes', action='store_true',
                   help='replace existing VMs without prompting')
    p.add_argument('--allow-tool-mismatch', action='store_true',
                   help='import even though the jaia tooling on PATH was built from a '
                        'different commit than the OVA')
    p.add_argument('--start-timeout', type=int, default=120)
    p.add_argument('--boot-timeout', type=int, default=1800)
    p.add_argument('--network-timeout', type=int, default=300)
    p.add_argument('--api-timeout', type=int, default=900)
    p.add_argument('--mission-timeout', type=int, default=2400)
    p.add_argument('--web-timeout', type=int, default=300)
    p.add_argument('--shutdown-timeout', type=int, default=300)
    args = p.parse_args(argv)

    if not args.ova and not args.ova_url:
        p.error('one of --ova-url or --ova is required')

    # the hub fragments a plan into at most 8 messages of 10 goals
    if not 2 <= args.waypoints <= 80:
        p.error('--waypoints must be between 2 and 80')
    # otherwise one dive could be matched to two neighbouring waypoints
    if args.waypoint_spacing <= 2 * args.waypoint_tolerance:
        p.error('--waypoint-spacing must be more than twice --waypoint-tolerance')

    args.mission_bots = ([int(b) for b in args.mission_bots.split(',') if b.strip()]
                         if args.mission_bots else [])
    args.hostonly_net = ipaddress.ip_network(args.hostonly_net)
    args.hostonly_base = args.hostonly_net.network_address + 10
    args.stages = [s.strip() for s in args.stages.split(',') if s.strip()]
    for s in args.stages:
        if s not in STAGES:
            p.error(f'unknown stage {s}; valid stages are {",".join(STAGES)}')
    return args


def main(argv):
    args = parse_args(argv)

    for tool in ('VBoxManage', 'ssh', 'curl'):
        if not shutil.which(tool):
            raise TestFailure(f'{tool} is not on PATH')
    if not shutil.which('jaia_ip'):
        raise TestFailure(
            'jaia_ip is not on PATH; install jaiabot-embedded or add this source '
            "tree's build/amd64/bin to PATH")
    if not os.path.exists(args.ssh_key):
        raise TestFailure(f'ssh key {args.ssh_key} does not exist')
    check_ssh_key_usable(args)

    nodes = ([Node('bot', int(i)) for i in args.bots.split(',') if i.strip()]
             + [Node('hub', int(i)) for i in args.hubs.split(',') if i.strip()])
    if not [n for n in nodes if n.type == 'hub']:
        raise TestFailure('at least one hub is needed to run the tests')

    log(f'fleet {args.fleet}: ' + ' '.join(n.name for n in nodes))
    log(f'fleet WLAN network: {jaia_ip("--query_type", "net", "--ip_net", "wlan", "--fleet_id", str(args.fleet))}')

    ova = stage_download(args) if 'download' in args.stages else (
        args.ova or os.path.join(args.cache_dir, os.path.basename(
            urllib.parse.urlparse(args.ova_url).path)))

    if 'import' in args.stages:
        stage_import(args, ova, nodes)
    else:
        resolve_nodes(args, ova, nodes)

    if 'hostonly' in args.stages:
        stage_hostonly(args, nodes)
    if 'boot' in args.stages:
        stage_boot(args, nodes)
    if 'network' in args.stages:
        stage_network(args, nodes)
    if 'api' in args.stages:
        stage_api(args, nodes)
    if 'web' in args.stages:
        stage_web(args, nodes)
    if 'shutdown' in args.stages:
        stage_shutdown(args, nodes)

    stage_banner('passed')
    log('all requested stages completed')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except (TestFailure, jaia_api.ApiError) as e:
        log(f'FAILED: {e}')
        sys.exit(1)
    except KeyboardInterrupt:
        log('interrupted')
        sys.exit(130)
