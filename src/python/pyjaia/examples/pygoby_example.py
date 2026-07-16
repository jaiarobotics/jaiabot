#!/usr/bin/env python3
"""Example: structuring a pygoby app the same way a real goby C++ app is
structured -- several interprocess subscriptions serviced together,
plus a loop() running at its own frequency that does periodic work and 
publishes when it has something to say. The goal is that switching between 
C++ goby development and Python pygoby development feels familiar.

pygoby itself does not spawn any threads -- publish()/subscribe()/spin() are
plain method calls, and it's up to the application to decide how (or whether)
to run them concurrently. Here:

  - One thread owns the SUB socket and services *all* subscriptions from a
    single spin() loop -- the Python analogue of how one goby C++ thread
    class services every interprocess().subscribe() it registers from its
    own poller loop. jaiabot_mission_manager.cpp feeds pressure_adjusted and
    salinity into its state machine; here we just cache the latest of each
    and publish a quick echo of each one back out.
  - The main thread is loop() -- ticking at a fixed, developer-set frequency,
    doing whatever periodic work is needed (here: reporting the latest cached
    values), and publishing on that same cadence rather than on an always-on
    separate timer.

ZMQ sockets aren't thread-safe to share: the SUB socket is only ever touched
from the subscribe thread. The PUB socket, however, is used from *both* the
subscribe thread's callbacks (to echo what they received) and loop() in the
main thread -- so instead of calling client.publish() directly, everything
here goes through the module-level publish() wrapper below, which holds
publish_lock for the duration of the call. This locking is deliberately kept
in the example, not pushed into pygoby.py itself: the library exposes plain,
non-thread-safe sockets, and it's up to the application to add its own
synchronization if it chooses to share one across threads.

Run against a live bot's gobyd, e.g.:

    python3 pygoby_example.py --platform bot1_fleet0
"""
import argparse
import logging
import threading
import time

from threading import Thread
from typing import Optional

from google.protobuf.message import Message

from jaiabot.messages.motor_pb2 import Motor
from jaiabot.messages.sensor.pressure_temperature_pb2 import PressureAdjustedData
from jaiabot.messages.sensor.salinity_pb2 import SalinityData
from pyjaia.pygoby import InterProcessClient

PRESSURE_ADJUSTED_GROUP = 'jaiabot::pressure_adjusted'
SALINITY_GROUP = 'jaiabot::salinity'
EXAMPLE_GROUP = 'pyjaia::example'
EXAMPLE_GROUP_2 = 'pyjaia::example_2'
LOOP_FREQUENCY_HZ = 0.5  # developer-set, same idea as ApplicationBase(loop_frequency) in C++

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('-p', '--platform', default='bot1_fleet0',
                     help='gobyd platform name to connect to (default: bot1_fleet0)')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s', level=logging.INFO)
log = logging.getLogger('pygoby_example')

# publish() is called from both the subscribe thread's callbacks and loop()
# in the main thread, so every call goes through this wrapper, which holds
# the lock for the duration of the underlying client.publish() call.
publish_lock = threading.Lock()


def publish(group: str, message: Message):
    with publish_lock:
        client.publish(group, message)

# Written by the subscribe thread's callbacks, read by loop() in the main
# thread. Safe without a lock: each write rebinds the name to a brand-new
# message object rather than mutating one in place, so loop() always sees
# either the previous complete object or the new one, never a half-written one.
latest_pressure_adjusted_data: Optional[PressureAdjustedData] = None
latest_salinity_data: Optional[SalinityData] = None


def on_pressure_adjusted(pa: PressureAdjustedData):
    # jaiabot_mission_manager.cpp instead feeds this into its state machine
    # (EvMeasurement.sensor_depth); here we cache it for loop() to report and
    # echo it straight back out as a demonstration of publishing from a
    # subscribe callback.
    global latest_pressure_adjusted_data
    latest_pressure_adjusted_data = pa

    publish(EXAMPLE_GROUP, pa)


def on_salinity(sal: SalinityData):
    # jaiabot_mission_manager.cpp instead feeds this into its state machine
    # (EvMeasurement.salinity/conductivity); here we cache it for loop() to
    # report and echo it back out on its own example group.
    if sal.HasField('salinity'):
        global latest_salinity_data
        latest_salinity_data = sal

        publish(EXAMPLE_GROUP_2, sal)


def subscribe_thread(client: InterProcessClient):
    client.subscribe(PRESSURE_ADJUSTED_GROUP, PressureAdjustedData, on_pressure_adjusted)
    client.subscribe(SALINITY_GROUP, SalinityData, on_salinity)
    while True:
        # No other work happens on this thread, so there's nothing for a
        # bounded timeout to unblock -- spin() reacts to a message just as
        # fast with the default timeout as with any other value.
        client.spin()


def loop(client: InterProcessClient):
    """The main thread's periodic action -- the Python analogue of a goby C++
    thread class's loop() override. Runs at LOOP_FREQUENCY_HZ, does whatever
    work is needed, and publishes only when it actually has something to say."""
    sequence = 0
    period_seconds = 1.0 / LOOP_FREQUENCY_HZ
    while True:
        sequence += 1
        log.info('loop() tick %d', sequence)

        if latest_pressure_adjusted_data is not None:
            log.info('  latest pressure_adjusted: sensor_depth=%.2f',
                     latest_pressure_adjusted_data.sensor_depth)
        if latest_salinity_data is not None:
            log.info('  latest salinity: salinity=%.2f conductivity=%.2f',
                     latest_salinity_data.salinity, latest_salinity_data.conductivity)

        message = Motor()
        message.rpm = sequence
        publish(EXAMPLE_GROUP, message)

        time.sleep(period_seconds)


client = InterProcessClient(platform=args.platform, client_name='pygoby_example')

Thread(target=subscribe_thread, args=(client,), daemon=True).start()

loop(client)
