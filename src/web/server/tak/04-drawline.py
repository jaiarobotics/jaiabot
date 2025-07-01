import requests
import json
import datetime # importing datetime module for now()
import math


##4TAK
import asyncio
import xml.etree.ElementTree as ET
import pytak
from configparser import ConfigParser


##Cleanup on Abort
import signal
import sys, os
def signal_handler(sig, frame):
    print('You pressed Ctrl+C!')
    sys.exit(0)
##Registering CTRL+C Handler
signal.signal(signal.SIGINT, signal_handler)



callsign = "Example"
currenttime = datetime.datetime.now().isoformat()



# Function takes an origin lat, lon, alt (meters);
# combines that with direction and elevation angles in degrees and distance in kilometers to generate a lob target
def KensLoB(lat_origin, lon_origin, alt_origin, direction_degrees, elevation_degrees, distance_km):

    earth_radius = 6371.0 # Earth radius in kilometers

    direction_rad = math.radians(direction_degrees)  # Convert angle from degrees to radians
    elevation_rad = math.radians(elevation_degrees)  # Convert angle from degrees to radians
    
    # Calculate change in latitude and longitude
    delta_lat = (distance_km * math.cos(direction_rad)) / earth_radius
    delta_lon = (distance_km * math.sin(direction_rad)) / (earth_radius * math.cos(math.radians(lat_origin)))
    delta_alt = distance_km * math.sin(elevation_rad)
    
    # Calculate new latitude and longitude for point 'b'
    lat_b = lat_origin + math.degrees(delta_lat)
    lon_b = lon_origin + math.degrees(delta_lon)
    alt_b = alt_origin + delta_alt
    
    return [lat_b, lon_b, alt_b]


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

        gps1 = [45.0,-83.4, 1.0]
        gps2 = KensLoB(gps1[0], gps1[1], gps1[2], 37, 2, 20)
        

        # Creating COT LoB template event from provided information:
        lob_cot = ET.Element("xml")                        #<xml
        lob_cot.set("version", "1.0")                      #   version = "1.0" />
        lob_cot.set("encoding", "utf-8")                   #   ecoding = "utf-8" />
        lob_cot.set("standalone", "yes")                   #   standalone = "yes" />
        lob_event = ET.SubElement(lob_cot, 'event')            #<event 
        lob_event.set("version", "2.0")                    #   version = "2.0"
        lob_event.set("uid", "MineLine")                   #   uid = MyLine
        lob_event.set("type", "u-d-f")                     #   "u-d-f" = ???
        lob_event.set("how", "m-g")                        #   how = "m-g"
        lob_event.set("time", pytak.cot_time())            #   time = "2023-07-04T08:00:01.22Z"
        lob_event.set("start", pytak.cot_time())           #   start = "2023-07-04T08:00:01.22Z"
        lob_event.set("stale", pytak.cot_time(120))        #   stale = "2023-07-04T08:00:03.22Z" />
        lob_point1 = ET.SubElement(lob_event, 'point')         #<point
        lob_point1.set("lat", str(gps1[0]))                #   lat = "45.0"
        lob_point1.set("lon", str(gps1[1]))                #   lon = "-83.4"
        lob_point1.set("hae", str(gps1[2]))                #   hae = height above earth set arbitrarily
        lob_point1.set("ce", "0.0")                        #   ce  = "2.009"
        lob_point1.set("le", "0.0")                        #   le = "3.7" />
        lob_point2 = ET.SubElement(lob_event, 'point')         #<point
        lob_point2.set("lat", str(gps2[0]))                #   lat = "44.0"
        lob_point2.set("lon", str(gps2[1]))                #   lon = "-81.2"
        lob_point2.set("hae", str(gps2[2]))                #   hae = height above earth set arbitrarily
        lob_point2.set("ce", "0.0")                        #   ce  = "2.009"
        lob_point2.set("le", "0.0")                        #   le = "3.7" />
        lob_detail = ET.SubElement(lob_event, 'detail')        #<detail/>
        lob_remarks = ET.SubElement(lob_detail, 'remarks')
        lob_remarks.text = "23 dB SNR"
        lob_status = ET.SubElement(lob_detail, 'status')
        lob_status.set("signal", "23.0")
        lob_link1 = ET.SubElement(lob_detail, 'link')
        lob_link1.set("point", str(gps1[0]) + ", " + str(gps1[1])) 
        lob_link2 = ET.SubElement(lob_detail, 'link')
        lob_link2.set("point", str(gps2[0]) + ", " + str(gps2[1]))
        lob_strokeColor = ET.SubElement(lob_detail, 'strokeColor')
        lob_strokeColor.set("value", "-99999")             # -200 Yellow , -99999 Red , -45678 Pink , -22222 Orange , -55555 Purple , -66366 Nearly White
        lob_strokeWeight = ET.SubElement(lob_detail, 'strokeWeight')
        lob_strokeWeight.set("value", "2.0")
        lob_strokeStyle = ET.SubElement(lob_detail, 'strokeStyle')
        lob_strokeStyle.set("value", "solid")               # solid, dashed, dotted
        print("CoT LoB Template Created")
        # FINISHED creating COT LoB event



        while 1:
            try:

                cotEvent = ET.tostring(lob_cot, encoding='utf-8')

                print(cotEvent)
                await self.handle_data(cotEvent)    # Enqueues COT for TX

            except Exception as e:
                print(e)
                exc_type, exc_obj, exc_tb = sys.exc_info()
                fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
                print(exc_type, fname, exc_tb.tb_lineno)
                pass


            await asyncio.sleep(15)             # Sleep 15 seconds then loop again. Change here to increase/decrease update speed.
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
#############################
# END MAIN APPLICATION
#############################


