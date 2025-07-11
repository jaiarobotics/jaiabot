#!/usr/bin/env python3
##Cleanup on Abort
import signal
import sys, os

import asyncio
import xml.etree.ElementTree as ET
import xml.dom.minidom
import pytak

from configparser import ConfigParser

def gen_cot():
    """Generate CoT Event."""
    root = ET.Element("event")
    root.set("version", "2.0")
    root.set("type", "a-h-A-M-A")
    root.set("uid", "Example")
    root.set("how", "m-g")
    root.set("time", pytak.cot_time())
    root.set("start", pytak.cot_time())
    root.set(
        "stale", pytak.cot_time(60)
    )  # time difference in seconds from 'start' when stale initiates

    pt_attr = {
        "lat": "45.0",
        "lon": "-85.0",
        "hae": "100",
        "ce": "10",
        "le": "10",
    }
    remarkstext = "Just an interesting Gage for what's happening..."

    ET.SubElement(root, "point", attrib=pt_attr)
    detail = ET.SubElement(root, "detail")
    ET.SubElement(detail, "remarks", text=remarkstext)

    return ET.tostring(root)


class MySender(pytak.QueueWorker):
    """
    Defines how you process or generate your Cursor-On-Target Events.
    From there it adds the COT Events to a queue for TX to a COT_URL.
    """

    async def handle_data(self, data):
        """Handle pre-CoT data, serialize to CoT Event, then puts on queue."""
        event = data
        await self.put_queue(event)

    async def run(self, number_of_iterations=-1):
        """Run the loop for processing or generating pre-CoT data."""
        while 1:
            data = gen_cot()
            self._logger.info("Sending:\n%s\n", data.decode())
            await self.handle_data(data)
            await asyncio.sleep(5)


class MyReceiver(pytak.QueueWorker):
    """Defines how you will handle events from RX Queue."""
    # NOTE THAT YOU WON'T RECEIVE EVENTS THAT YOU SENT WITH THIS PROCESS,
    # THE SERVER KNOWS YOU WERE THE SENDER AND DOESN'T DUPLICATE BACK TO YOU.

    async def handle_data(self, data):
        """Handle data from the receive queue."""
        try:
            newtree = ET.fromstring(data.decode())
            newtree_str = ET.tostring(newtree)
            newtree_str = xml.dom.minidom.parseString(newtree_str)
            newtree_str = newtree_str.toprettyxml(indent="  ")
            #print(newtree_str)

            if(newtree.tag == "event") & (newtree.get("uid") is not None):
                for point in newtree.findall("point"):
                    mylat, mylon, myhae, myce, myle = point.attrib.items()
                    print(str(newtree.get("uid")) + " @ " + str(mylat) + str(mylon))

        except Exception as e:
           print(e)
           exc_type, exc_obj, exc_tb = sys.exc_info()
           fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
           print(exc_type, fname, exc_tb.tb_lineno)

    async def run(self):  # pylint: disable=arguments-differ
        """Read from the receive queue, put data onto handler."""
        while 1:
            data = (
                await self.queue.get()
            )  # this is how we get the received CoT from rx_queue
            await self.handle_data(data)


async def main():
    """Main definition of your program, sets config params and
    adds your serializer to the asyncio task list.
    """
    config = ConfigParser()
    config.read('initiative.ini')
    config = config["connection"]

    # Initializes worker queues and tasks.
    clitool = pytak.CLITool(config)
    await clitool.setup()

    # Add your serializer to the asyncio task list.
    clitool.add_tasks(
        set([MySender(clitool.tx_queue, config), MyReceiver(clitool.rx_queue, config)])
    )

    # Start all tasks.
    await clitool.run()


if __name__ == "__main__":
    asyncio.run(main())
