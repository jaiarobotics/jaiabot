#!/usr/bin/env python3
##Cleanup on Abort
import sys, os
import signal
import keyboard

import asyncio
import xml.etree.ElementTree as ET
import xml.dom.minidom
import pytak

from configparser import ConfigParser

mylatlon = [45, -85]

def gen_cot():
    """Generate CoT Event."""
    cot_event = ET.Element("event")
    cot_event.set("version", "2.0")
    cot_event.set("type", "a-j-G-I-A")
    cot_event.set("uid", "Example")
    cot_event.set("how", "m-g")
    cot_event.set("time", pytak.cot_time())
    cot_event.set("start", pytak.cot_time())
    cot_event.set("stale", pytak.cot_time(60))

    global mylatlon
    pt_attr = {
        "lat": str(mylatlon[0]),  
        "lon": str(mylatlon[1]),  
        "hae": "100",
        "ce": "10",
        "le": "10",
    }
    ET.SubElement(cot_event, "point", attrib=pt_attr)
    detail = ET.SubElement(cot_event, "detail")
    ET.SubElement(detail, "remarks", text="'Kpop!' Goes the weasel.")
    return ET.tostring(cot_event)

class MySender(pytak.QueueWorker):
    async def handle_data(self, data):
        """Handle pre-CoT data, serialize to CoT Event, then puts on queue."""
        event = data
        await self.put_queue(event)

    async def run(self, number_of_iterations=-1):
        while True:
            try:
                await asyncio.sleep(1)
            except asyncio.CancelledError:
                # If cancelled, exit the loop
                break
        return

    async def send(self, cot):
        try:
            self._logger.info("Sending:\n%s\n", cot.decode())
            await self.handle_data(cot)
        except Exception as e:
            print(e)
        return

async def main():
    def signal_handler(signal, frame):
        print("Ctrl+C caught.\n")
        asyncio.get_event_loop().stop()
        exit()
    signal.signal(signal.SIGINT, signal_handler)

    config = ConfigParser()
    config.read('initiative.ini')
    config = config["connection"]
    # Initializes worker queues and tasks.
    clitool = pytak.CLITool(config)
    await clitool.setup()

    global KeySender
    KeySender = MySender(clitool.tx_queue, config)
    # Add your serializer to the asyncio task list.
    clitool.add_tasks(set([KeySender]))

    # Start all tasks.
    await asyncio.gather(listen_key_presses(), clitool.run())


##
#Moves the lat long based on arrow key interactions, and sends a CoT event whenever the space bar is pressed.
##
async def listen_key_presses():
    global KeySender
    global mylatlon
    while True:
        try:
            event = keyboard.read_event()
            if event.event_type == keyboard.KEY_DOWN:
                if event.name == 'up':
                    mylatlon[0] += 0.2
                    print(mylatlon)
                elif event.name == 'down':
                    mylatlon[0] -= 0.2
                    print(mylatlon)
                elif event.name == 'right':
                    mylatlon[1] += 0.2
                    print(mylatlon)
                elif event.name == 'left':
                    mylatlon[1] -= 0.2
                    print(mylatlon)
                elif event.name == 'space':
                    await KeySender.send(gen_cot())
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            # If cancelled, exit the loop
            break

if __name__ == "__main__":
    asyncio.run(main())
