#!/usr/bin/env python3
import signal
import sys, os

import asyncio
import xml.etree.ElementTree as ET
import xml.dom.minidom
import pytak

from configparser import ConfigParser

logfile = open('my_log.txt', 'a')

class MyReceiver(pytak.QueueWorker):
    """Defines how you will handle events from RX Queue."""

    async def handle_data(self, data):
        """Handle data from the receive queue."""
        try:
            newtree = ET.fromstring(data.decode())
            ## PRETTY PRINT FOR DEBUGGING
            newtree_str = ET.tostring(newtree)
            newtree_str = xml.dom.minidom.parseString(newtree_str)
            newtree_str = newtree_str.toprettyxml(indent="  ")
            print(newtree_str)
            ## END OF PRETTY PRINT CODE

            if(newtree.tag == "event") & (newtree.get("uid") is not None):
                if newtree.get("uid") != "BoringExampleUID":
                    # Ignore some known uninteresting event ID
                    return
                
                if newtree.find("detail") is not None:
                    detailtree= newtree.find("detail")
                    if detailtree.find("remarks") is not None:
                          print(newtree.find("detail").find("remarks").get("text"))
                          # There's some interesting nugget of data being reported here...

                for point in newtree.findall("point"):
                    mylat, mylon, myhae, myce, myle = point.attrib.items()
                    print(str(newtree.get("uid")) + " @ " + str(mylat) + str(mylon))
                    # This is where the event was reported...

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
        set([MyReceiver(clitool.rx_queue, config)])
    )

    # Start all tasks.
    await clitool.run()


if __name__ == "__main__":
    asyncio.run(main())
