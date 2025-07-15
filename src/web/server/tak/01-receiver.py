#!/usr/bin/env python3
import signal
import sys, os
import json

import asyncio
import xml.etree.ElementTree as ET
import xml.dom.minidom
import pytak

from configparser import ConfigParser

logfile = open('my_log.txt', 'a')

class MyReceiver(pytak.QueueWorker):
    """Defines how you will handle events from RX Queue."""

    def __init__(self, queue, config, callback=None):
        super().__init__(queue, config)
        self.callback = callback

    async def handle_data(self, data):
        """Handle data from the receive queue."""
        try:
            newtree = ET.fromstring(data.decode())

            if newtree.tag == "event" and newtree.get("uid") is not None:
                # Check if this is a waypoint based on contact callsign
                if self.is_waypoint_callsign(newtree):
                    ## PRETTY PRINT FOR DEBUGGING - ONLY FOR WAYPOINTS
                    newtree_str = ET.tostring(newtree)
                    newtree_str = xml.dom.minidom.parseString(newtree_str)
                    newtree_str = newtree_str.toprettyxml(indent="  ")
                    print(newtree_str)
                    ## END OF PRETTY PRINT CODE
                    
                    await self.process_waypoint_event(newtree)
                # Silently ignore non-waypoint events - no output at all

        except Exception as e:
           print(f"Error processing CoT: {e}")
           exc_type, exc_obj, exc_tb = sys.exc_info()
           fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
           print(exc_type, fname, exc_tb.tb_lineno)

    def is_waypoint_callsign(self, newtree):
        """Check if the contact callsign contains 'waypoint'"""
        try:
            detail = newtree.find("detail")
            if detail is not None:
                contact = detail.find("contact")
                if contact is not None:
                    callsign = contact.get("callsign", "").lower()
                    return "waypoint" in callsign
            return False
        except Exception as e:
            print(f"Error checking callsign: {e}")
            return False

    async def process_waypoint_event(self, newtree):
        """Process a waypoint CoT event"""
        try:
            uid = newtree.get("uid")
            event_type = newtree.get("type")
            
            print(f"🎯 Processing WAYPOINT event: UID={uid}, Type={event_type}")
            
            # Extract location data
            point = newtree.find("point")
            if point is None:
                print("❌ No point data in waypoint event")
                return
                
            lat = float(point.get("lat"))
            lon = float(point.get("lon"))
            hae = float(point.get("hae", 0))
            
            print(f"📍 Waypoint Location: lat={lat}, lon={lon}, hae={hae}")
            
            # Extract callsign and remarks
            callsign = "Unknown"
            remarks = ""
            
            detail = newtree.find("detail")
            if detail is not None:
                contact = detail.find("contact")
                if contact is not None:
                    callsign = contact.get("callsign", "Unknown")
                
                remarks_elem = detail.find("remarks")
                if remarks_elem is not None:
                    remarks = remarks_elem.text or ""
            
            # Create waypoint data structure
            waypoint_data = {
                "uid": uid,
                "type": event_type,
                "lat": lat,
                "lon": lon,
                "hae": hae,
                "callsign": callsign,
                "remarks": remarks,
                "timestamp": newtree.get("time")
            }
            
            print(f"🚀 Sending waypoint to simulator: {waypoint_data}")
            await self.send_to_simulator(waypoint_data)

        except Exception as e:
            print(f"Error processing waypoint event: {e}")

    async def send_to_simulator(self, waypoint_data):
        """Send waypoint data to simulator"""
        try:
            if self.callback:
                await self.callback(waypoint_data)
            else:
                print("=" * 60)
                print("🎯 WAYPOINT FOR SIMULATOR:")
                print(f"  Latitude:  {waypoint_data['lat']}")
                print(f"  Longitude: {waypoint_data['lon']}")
                print(f"  Callsign:  {waypoint_data['callsign']}")
                print(f"  Remarks:   {waypoint_data['remarks']}")
                print(f"  UID:       {waypoint_data['uid']}")
                print("=" * 60)
        
        except Exception as e:
            print(f"Error sending waypoint to simulator: {e}")

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
