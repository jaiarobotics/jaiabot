from gpsdclient import GPSDClient
from gpsdsimulator import GPSDSimulator, WaveComponent
from time import sleep

# or as python dicts (optionally convert time information to `datetime` objects)
with GPSDSimulator(wave_components=[WaveComponent(frequency=2, amplitude=1)]) as client:
    for result in client.dict_stream(convert_datetime=True, filter=["TPV"]):
        print("Latitude: %s" % result.get("lat", "n/a"))
        print("Longitude: %s" % result.get("lon", "n/a"))
        print(f'Altitude: {result.get("altHAE", "n/a")}')
        sleep(1)
