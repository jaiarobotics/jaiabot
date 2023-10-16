from jaia_messages import *
from pprint import pprint
import math
import zipfile
from typing import Iterable, List


def task_packet_to_kml_placemarks(task_packet: TaskPacket):
    '''Converts a task packet to an array of kmz placemarks in string form'''

    def entry(name: str, value: float, units: str):
        '''Returns a line of data, only if value is non-None, with units'''

        if value is None:
            return ''
        else:
            return f'{name}: {value:.2f} {units}<br />'


    placemarks: list[str] = []

    # Bail if this task packet is the less precise DCCL copy
    if (task_packet._scheme_ != 1):
        return []
    
    bot_id = task_packet.bot_id

    if task_packet.dive and task_packet.dive.depth_achieved != 0:
        dive = task_packet.dive
        depth_string = f"{dive.depth_achieved:.2f} m"
        depth_measurement_string = '' 

        if dive.measurement:
            for i, measurement in enumerate(dive.measurement):
                depth_measurement_string += f'''
                    Index: {i+1} <br />
                    {entry("Mean-Depth", measurement.mean_depth, "m")}
                    {entry("Mean-Temperature", measurement.mean_temperature, "°C")}
                    {entry("Mean-Salinity", measurement.mean_salinity, "PSS")}
                '''

        duration_to_acquire_gps_string = f'Duration-to-GPS: {dive.duration_to_acquire_gps:.2f} s<br />' if dive.duration_to_acquire_gps else ''

        placemark_string = f'''
            <Placemark>
                <name>{depth_string}</name>
                <description>
                    <h2>Dive</h2>
                    Bot-ID: {bot_id}<br />
                    Time: {micros_to_string(task_packet.start_time)}<br />
                    Depth: {depth_string}<br />
                    Bottom-Dive: {"Yes" if dive.bottom_dive else "No"}<br />
                    {duration_to_acquire_gps_string}
                    Unpowered-Rise-Rate: {dive.unpowered_rise_rate or 0.0:.2f} m/s<br />
                    Powered-Rise-Rate: {dive.powered_rise_rate or 0.0:.2f} m/s<br />
                    Bottom-Type: {dive.bottom_type} <br />
                    {depth_measurement_string}
                </description>
                <Point>
                    <coordinates>{dive.start_location.lon},{dive.start_location.lat}</coordinates>
                </Point>
                <Style>
                    <IconStyle>
                        <Icon>
                            <href>files/bottomStrike.png</href>
                            <scale>0.5</scale>
                        </Icon>
                    </IconStyle>
                </Style>
            </Placemark>
        '''

        placemarks.append(placemark_string)

    # Add the drift, if present
    drift = task_packet.drift
    if drift and drift.drift_duration != 0:
        DEG = math.pi / 180
        speed_string = f'{drift.estimated_drift.speed or 0.0:.2f} m/s'

        def fix_range(x: float, x_min: float, x_max: float):
            y = (x - x_min) / (x_max - x_min) # Units of x_max - x_min of x above x_min
            z = y - math.floor(y) # Get only the fractional part
            return x_min + z * (x_max - x_min)

        heading = fix_range(math.atan2(drift.end_location.lon - drift.start_location.lon, drift.end_location.lat - drift.start_location.lat) / DEG - 90, 0, 360)

        drift_description = f'''
            <h2>Drift</h2>
            Bot-ID: {bot_id}<br />
            Start: {micros_to_string(task_packet.start_time)}<br />
            Duration: {drift.drift_duration} s<br />
            Speed: {speed_string}<br />
            Heading: {drift.estimated_drift.heading or 0.0:.2f} deg<br />
            Significant-Wave-Height {drift.significant_wave_height or 0.0:.2f} m<br />
            Wave-Height {drift.wave_height or 0.0:.2f} m<br />
            Wave-Period {drift.wave_period or 0.0:.2f} s<br />
        '''

        drift_placemark_string = f'''
            <Placemark>
                <name>Drift</name>
                <description>
                    {drift_description}
                </description>
                <LineString>
                    <coordinates>{drift.start_location.lon},{drift.start_location.lat} {drift.end_location.lon},{drift.end_location.lat}</coordinates>
                </LineString>
                <Style>
                    <LineStyle>
                        <color>ff008cff</color>            <!-- kml:color -->
                        <colorMode>normal</colorMode>      <!-- colorModeEnum: normal or random -->
                        <width>4</width>                            <!-- float -->
                        <gx:labelVisibility>0</gx:labelVisibility>  <!-- boolean -->
                    </LineStyle>
                </Style>
            </Placemark>

            <Placemark>
                <name>{speed_string}</name>
                <description>
                    {drift_description}
                </description>
                <Point>
                    <coordinates>{drift.end_location.lon},{drift.end_location.lat}</coordinates>
                </Point>
                <Style>
                    <IconStyle>
                        <color>ff008cff</color>            <!-- kml:color -->
                        <colorMode>normal</colorMode>      <!-- kml:colorModeEnum:normal or random -->
                        <scale>1.0</scale>                   <!-- float -->
                        <heading>{heading}</heading>               <!-- float -->
                        <Icon>
                            <href>files/arrowHead.png</href>
                        </Icon>
                        <hotSpot x="0.5"  y="0.5"
                            xunits="fraction" yunits="fraction"/>    <!-- kml:vec2 -->
                    </IconStyle>
                </Style>
            </Placemark>
        '''

        placemarks.append(drift_placemark_string)

    return placemarks


def kml_from_task_packets(task_packets: Iterable[TaskPacket]):
    '''Returns a kml string for the provided list of task packets'''

    placemarks: List[str] = []
    task_packets = list(task_packets)
    for task_packet in task_packets:
        placemarks += task_packet_to_kml_placemarks(task_packet)

    document_string = ''.join(placemarks)

    return f'''
        <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/kml/2.2 https://developers.google.com/kml/schema/kml22gx.xsd">
            <Document>
                {document_string}
            </Document>
        </kml>
    '''


def write_file(task_packets: Iterable[TaskPacket], output_kmz_path: str):
    '''Creates a kmz file at output_kmz_path, containing placemarks for the input task_packets'''
    with zipfile.ZipFile(output_kmz_path, 'w') as output_kmz_file:
        kml_file_string = kml_from_task_packets(task_packets)
        output_kmz_file.writestr('doc.kml', kml_file_string)

        output_kmz_file.write('kmz_files/bottomStrike.png', 'files/bottomStrike.png')
        output_kmz_file.write('kmz_files/arrowHead.png', 'files/arrowHead.png')


if __name__ == '__main__':

    test_json = [
        {
            '_datenum_': 738987.7720019894, 
            '_scheme_': 2, 
            '_utime_': 1681237900971882, 
            'bot_id': 3, 
            'dive': {
                'depth_achieved': 0.0, 
                'dive_rate': 0.0, 
                'measurement': [
                    {'mean_depth': 2.0}
                ], 
                'start_location': {
                    'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.661816, 'lon': -71.274158}, 'estimated_drift': {'heading': 242.0, 'speed': 0.2}, 'start_location': {'lat': 41.661829, 'lon': -71.274126}}, 'end_time': 1681237901000000, 'start_time': 1681237880000000, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7720019902, '_scheme_': 1, '_utime_': 1681237900971948, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.661815833, 'lon': -71.274158167}, 'estimated_drift': {'heading': 242.45280311758262, 'speed': 0.1524581284292486}, 'start_location': {'lat': 41.661829167, 'lon': -71.274126167}}, 'end_time': 1681237900944338, 'start_time': 1681237880346657, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7765156763, '_scheme_': 2, '_utime_': 1681238290954430, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.661819, 'lon': -71.27421}, 'estimated_drift': {'heading': 260.0, 'speed': 0.4}, 'start_location': {'lat': 41.661831, 'lon': -71.274126}}, 'end_time': 1681238291000000, 'start_time': 1681238270000000, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7765156766, '_scheme_': 1, '_utime_': 1681238290954458, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.6618185, 'lon': -71.274210333}, 'estimated_drift': {'heading': 260.0633319265689, 'speed': 0.3590504622377217}, 'start_location': {'lat': 41.661831333, 'lon': -71.274125833}}, 'end_time': 1681238290943480, 'start_time': 1681238270249216, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7771290708, '_scheme_': 2, '_utime_': 1681238343951713, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.661939, 'lon': -71.273221}, 'estimated_drift': {'heading': 59.0, 'speed': 0.3}, 'start_location': {'lat': 41.661907, 'lon': -71.273288}}, 'end_time': 1681238344000000, 'start_time': 1681238323000000, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7771290711, '_scheme_': 1, '_utime_': 1681238343951737, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.6619385, 'lon': -71.2732215}, 'estimated_drift': {'heading': 59.09518384510244, 'speed': 0.328064083306214}, 'start_location': {'lat': 41.661906833, 'lon': -71.273288}}, 'end_time': 1681238343943575, 'start_time': 1681238323446598, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7777193702, '_scheme_': 2, '_utime_': 1681238394953581, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.662236, 'lon': -71.274063}, 'estimated_drift': {'heading': 282.0, 'speed': 0.5}, 'start_location': {'lat': 41.66222, 'lon': -71.273948}}, 'end_time': 1681238395000000, 'start_time': 1681238374000000, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7777193706, '_scheme_': 1, '_utime_': 1681238394953615, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.662236, 'lon': -71.274063}, 'estimated_drift': {'heading': 282.38991735521716, 'speed': 0.48556507853828235}, 'start_location': {'lat': 41.6622195, 'lon': -71.2739485}}, 'end_time': 1681238394946450, 'start_time': 1681238373961845, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.7785990068, '_scheme_': 2, '_utime_': 1681238470954187, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.661597, 'lon': -71.273607}, 'estimated_drift': {'heading': 85.0, 'speed': 0.9}, 'start_location': {'lat': 41.661579, 'lon': -71.273819}}, 'end_time': 1681238471000000, 'start_time': 1681238450000000, 'type': 'SURFACE_DRIFT'}, {'_datenum_': 738987.778599007, '_scheme_': 1, '_utime_': 1681238470954207, 'bot_id': 3, 'dive': {'depth_achieved': 0.0, 'dive_rate': 0.0, 'measurement': [], 'start_location': {'lat': 0.0, 'lon': 0.0}}, 'drift': {'drift_duration': 20, 'end_location': {'lat': 41.661596667, 'lon': -71.2736075}, 'estimated_drift': {'heading': 84.97743570260002, 'speed': 0.8865691826587077}, 'start_location': {'lat': 41.6615785, 'lon': -71.273819}}, 'end_time': 1681238470943383, 'start_time': 1681238450055899, 'type': 'SURFACE_DRIFT'}]

    task_packets = map(TaskPacket.from_dict, test_json)

    create_kmz(task_packets, 'test.kmz')

