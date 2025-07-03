import warnings
warnings.filterwarnings("ignore")

# import logging
# logging.basicConfig(level=logging.ERROR)
# logging.getLogger("pytak").setLevel(logging.ERROR)
# logging.getLogger("asyncio").setLevel(logging.ERROR)

import asyncio
import xml.etree.ElementTree as ET
import pytak
import logging
from configparser import ConfigParser
import argparse


# Patch pytak logger to suppress INFO messages
for logger_name in ("pytak", "pytak.classes"):
    logger = logging.getLogger(logger_name)
    logger.handlers.clear()
    logger.setLevel(logging.ERROR)
    logger.propagate = False


parser = argparse.ArgumentParser()
parser.add_argument("--lat", type=float, default=45.06857)
parser.add_argument("--lon", type=float, default=-83.43467)
parser.add_argument("--callsign", type=str, default="JAIABOT")
parser.add_argument("--speed", type=float, default=2.5)
parser.add_argument("--course", type=float, default=0)
parser.add_argument("--remarks", type=str, default="")
parser.add_argument("--loop", type=lambda x: (str(x).lower() == 'true'), default=True, help="Send repeatedly if True, once if False")
args, unknown = parser.parse_known_args()

callsign = args.callsign
lat = args.lat
lon = args.lon
speed = args.speed
course = args.course

#############################
# Class Defintion for asynchronous delegate
#    Processes you Cursor-On-Target events information from above and 
#    adds places the formatted XML onto the TX queue facing TAK Sever.
#############################
class AsyncDelegate(pytak.QueueWorker):

    async def handle_data(self, data):
    # This routine places COT events on TX queue.
        event = data
        await self.put_queue(event)

    async def run(self, number_of_iterations=-1):
        # Use the --loop argument to control repetition
        first = True
        while args.loop or first:
            first = False

            # Creating COT event from provided information:
            cot = ET.Element("xml")                        #<xml
            cot.set("version", "1.0")                      #   version = "1.0" />
            cot.set("encoding", "utf-8")                   #   ecoding = "utf-8" />
            cot.set("standalone", "yes")                   #   standalone = "yes" />

            event = ET.SubElement(cot, 'event')            #<event 
            event.set("version", "2.0")                    #   version = "2.0"
            event.set("type", "a-f-S-U")                     #   type = "a-f-S-U"
            event.set("uid", callsign)                     #   uid = "{callsign}"
            event.set("how", "m-g")                        #   how = "m-g"
            event.set("time", pytak.cot_time())            #   time = "2023-07-04T08:00:01.22Z"
            event.set("start", pytak.cot_time())           #   start = "2023-07-04T08:00:01.22Z"
            event.set("stale", pytak.cot_time(120))        #   stale = "2023-07-04T08:00:03.22Z" />

            point = ET.SubElement(event, 'point')          #<point
            point.set("lat", str(args.lat))                #   lat = "45.06857"
            point.set("lon", str(args.lon))                #   lon = "-83.43467"
            point.set("hae", "15.0")                       #   hae = "15.0"
            point.set("ce", "2.009")                       #   ce  = "2.009"
            point.set("le", "3.7")                         #   le = "3.7" />
            point.set("speed", str(args.speed))            #   speed = "0.0"
            
            detail = ET.SubElement(event, 'detail')
            contact = ET.SubElement(detail, 'contact')
            contact.set("callsign", callsign)

            # Add a <track> element for line of bearing
            track = ET.SubElement(detail, 'track')
            track.set("course", str(args.course))  # Bearing in degrees (0-360)
            track.set("speed", str(args.speed))    # Speed in m/s

            remarks = ET.SubElement(detail, 'remarks')     #   <contact
            remarks.text = args.remarks

            cotEvent = ET.tostring(cot, encoding='utf-8')
            await self.handle_data(cotEvent)
            if args.loop:
                await asyncio.sleep(30)
#############################
#############################


##############################
# MAIN APPLICATION ENTRY POINT
##############################
async def main():
    # Import amd build configuration object required for pyTAK
    config = ConfigParser()
    config.read('initiative.ini')
    config = config["connection"]

    # Initializes worker queues and tasks.
    clitool = pytak.CLITool(config)
    await clitool.setup()

    # Add your serializer to the asyncio task list.
    clitool.add_tasks(set([AsyncDelegate(clitool.tx_queue, config)]))

    # Start all tasks.
    await clitool.run()


if __name__ == "__main__":
    asyncio.run(main())