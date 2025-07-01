
import asyncio
import xml.etree.ElementTree as ET
import pytak
from configparser import ConfigParser


callsign = "BLUE KNIGHT"

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
    # This routine is the loop continually processing pre-COT data into an XML COT
    #    then it passes the data to the routine which puts COT events on the TX queue.
    #    Creates a new event every 30 seconds.
        while 1:

            # Creating COT event from provided information:
            cot = ET.Element("xml")                        #<xml
            cot.set("version", "1.0")                      #   version = "1.0" />
            cot.set("encoding", "utf-8")                   #   ecoding = "utf-8" />
            cot.set("standalone", "yes")                   #   standalone = "yes" />

            event = ET.SubElement(cot, 'event')            #<event 
            event.set("version", "2.0")                    #   version = "2.0"
            event.set("type", "a-f-G")                     #   type = "a-k-G"
            event.set("uid", callsign)                     #   uid = "{callsign}"
            event.set("how", "m-g")                        #   how = "m-g"
            event.set("time", pytak.cot_time())            #   time = "2023-07-04T08:00:01.22Z"
            event.set("start", pytak.cot_time())           #   start = "2023-07-04T08:00:01.22Z"
            event.set("stale", pytak.cot_time(120))        #   stale = "2023-07-04T08:00:03.22Z" />

            point = ET.SubElement(event, 'point')          #<point
            point.set("lat", "45.06857")                   #   lat = "45.06857"
            point.set("lon", "-83.43467")                  #   lon = "-83.43467"
            point.set("hae", "15.0")                       #   hae = "15.0"
            point.set("ce", "2.009")                       #   ce  = "2.009"
            point.set("le", "3.7")                         #   le = "3.7" />
            
            detail = ET.SubElement(event, 'detail')        #<detail/>
            contact = ET.SubElement(detail, 'contact')     #   <contact
            contact.set("callsign", callsign)              #      callsign="{callsign}" />

            remarks = ET.SubElement(detail, 'remarks')     #   <contact
            remarks.text = "Potentially More Usefuly Info:/n Power + Freq"

            cotEvent = ET.tostring(cot, encoding='utf-8')  #</xml>
            # FINISHED creating COT event
            
            print(cotEvent)
            await self.handle_data(cotEvent)    # Enqueues COT for TX
            await asyncio.sleep(30)             # Sleep 30 seconds then loop again. Change here to increase/decrease update speed.
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