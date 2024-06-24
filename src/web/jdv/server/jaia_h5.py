from typing import List, Union, AbstractSet, Dict
from pathlib import Path
from objects import jaialog_get_object_list
from pyjaia.series import *
from pyjaia.h5_tools import *
from threading import Lock

import h5py
import logging
import os
import re
import json


try:
    path_descriptions = json.load(open('jaiabot_paths.json'))
except FileNotFoundError:
    path_descriptions = {}


def jaia_get_description(path):
    for description in path_descriptions:
        if 'path' in description:
            if description['path'] == path:
                return description
        
        if 'path_regex' in description:
            if re.match(description['path_regex'], path):
                return description
    
    return None


def get_title_from_path(path: str):
    components = path.split('/')
    if len(components) < 2:
        logging.warning(f'Not enough components in path: {path}')
        return ''

    components = components[1:]

    message_type_components = components[0].split('.')

    if len(message_type_components) < 1:
        logging.warning(f'Invalid path: {path}')
        return ''

    components[0] = components[0].split('.')[-1]
    return '/'.join(components)


# This lock is locked whenever a thread is checking to open an h5 file, potentially doing some goby -> h5 conversions
# It is used because we don't want multiple python "threads" (they're not really threads but behave that way) to 
# run goby log convert on the same log at the same time.
conversionLock = Lock()


class JaiaH5FileSet:
    h5Filenames: List[str]
    h5Files: List[h5py.File] = None

    def __init__(self, filenames: List[Union[str, Path]], shouldConvertGoby=False) -> None:
        self.h5Filenames = filenames
        self._getH5Files(shouldConvertGoby)

    def duration(self):
        '''Returns duration in seconds'''
        UTIME_PATH = 'goby::health::report/goby.middleware.protobuf.VehicleHealth/_utime_'

        try:
            h5File = self.h5Files[0]
        except IndexError:
            return None

        # Get duration of the first log, if the h5 file exists
        try:
            start = h5File[UTIME_PATH][0]
            end = h5File[UTIME_PATH][-1]
            return int(end - start)
        except (OSError, KeyError) as e:
            logging.debug(e)
            return None

    def _getH5Files(self, shouldConvertGoby: bool):
        h5Files: List[h5py.File] = []

        with conversionLock:
            for h5FileName in self.h5Filenames:
                h5Path = Path(h5FileName)

                if h5Path.is_file():
                    try:
                        h5Files.append(h5py.File(h5FileName))
                    except (BlockingIOError, OSError) as e:
                        logging.debug(f'While trying to open {h5FileName}, exception occured: {e}')
                    continue

                # h5 file doesn't exist

                # Not supposed to convert goby files, so exception
                if not shouldConvertGoby:
                    e = FileNotFoundError()
                    e.filename = h5Path
                    raise e

                # Otherwise convert
                gobyPath = h5Path.with_suffix('.goby')
                if gobyPath.is_file():
                    # convert goby file to h5 file
                    cmd = f'nice -n 10 goby log convert --input_file {gobyPath} --output_file {h5Path} --format HDF5'
                    logging.info(cmd)
                    os.system(cmd)
                else:
                    # Can't find goby file, so exception
                    logging.error(f'Cannot find "{h5Path}" or "{gobyPath}"')
                    e = FileNotFoundError()
                    e.filename = h5Path
                    e.filename2 = gobyPath
                    raise e

                # Add the generated or existing h5 file
                try:
                    h5Files.append(h5py.File(h5FileName))
                except (OSError) as e:
                    logging.debug(f'{e}: while opening {h5FileName}')
                    continue

        self.h5Files = h5Files

    def fields(self, root_path: str = None):
        '''Returns a list of the available data fields below a root_path'''
        fields: AbstractSet[str] = set()

        if root_path is None or root_path == '' or root_path == '/':
            root_path = '/'
        else:
            # h5py doesn't like initial slashes, unless it's the root path
            root_path = root_path.lstrip('/')

        print(root_path)

        for h5_file in self.h5Files:
            try:
                fields = fields.union(h5_file[root_path].keys())
            except AttributeError:
                # If this path is a dataset, it has no "keys()"
                pass
        
        series = list(fields)
        series.sort()

        return series

    def commands(self):
        # A dictionary mapping bot_id to an array of mission dictionaries
        results: Dict[str, Dict] = {}

        for log_file in self.h5Files:
            # Search for Command items
            for path in log_file.keys():

                HUB_COMMAND_RE = re.compile(r'jaiabot::hub_command.*')
                m = HUB_COMMAND_RE.match(path)
                if m is not None:
                    hub_command_path = path

                    
                    command_path = hub_command_path + '/jaiabot.protobuf.Command'
                    commands = jaialog_get_object_list(log_file[command_path], repeated_members={"goal"})

                    try:
                        bot_id = commands[0]['bot_id']
                    except IndexError: # No commands
                        continue

                    results[bot_id] = commands

        return results

    def map(self):
        NodeStatus_lat_path = 'goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/lat'
        NodeStatus_lon_path = 'goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/lon'
        NodeStatus_heading_path = 'goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/pose/heading'
        NodeStatus_course_over_ground_path = 'goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/pose/course_over_ground'
        DesiredSetpoints_heading_path = 'jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints/helm_course/heading'

        seriesDict: Dict[str, list] = {}
        desired_heading_series = Series()

        for log in self.h5Files:
            # Get Bot id from the filename
            bot_id_pattern = re.compile(r'bot(\d+)')
            bot_id = re.findall(bot_id_pattern, log.filename)
            bot_id_string = str(bot_id[0])

            lat_series = Series.loadFromH5File(log=log, path=NodeStatus_lat_path, invalid_values=[0])
            lon_series = Series.loadFromH5File(log=log, path=NodeStatus_lon_path, invalid_values=[0])
            heading_series = Series.loadFromH5File(log=log, path=NodeStatus_heading_path)
            course_over_ground_series = Series.loadFromH5File(log=log, path=NodeStatus_course_over_ground_path)

            thisSeries = []

            desired_heading_series = Series.loadFromH5File(log=log, path=DesiredSetpoints_heading_path)

            for i, lat in enumerate(lat_series.y_values):
                most_recent_desired_heading = desired_heading_series.getValueAtTime(lat_series.utime[i])
                thisSeries.append([
                    lat_series.utime[i], 
                    lat_series.y_values[i], 
                    lon_series.y_values[i], 
                    heading_series.y_values[i], 
                    course_over_ground_series.y_values[i], 
                    most_recent_desired_heading
                ])

            if bot_id_string not in seriesDict:
                seriesDict[bot_id_string] = []

            seriesDict[bot_id_string].extend(thisSeries)

        return seriesDict

    def activeGoals(self):
        # A dictionary mapping bot_id to an array of active_goal dictionaries
        results: Dict[str, List] = {}

        BOT_STATUS_RE = re.compile(r'^jaiabot::bot_status.*/jaiabot.protobuf.BotStatus$')

        for log_file in self.h5Files:

            def visit_path(name: str, object):
                m = BOT_STATUS_RE.match(name)

                if m is not None:
                    _utime_ = h5_get_series(log_file[name + '/_utime_'])
                    bot_ids = h5_get_series(log_file[name + '/bot_id'])
                    active_goals = h5_get_series(log_file[name + '/active_goal'])

                    last_active_goal = None
                    for i in range(len(_utime_)):
                        if active_goals[i] != last_active_goal:
                            bot_id = bot_ids[i]
                            if bot_id not in results:
                                results[bot_id] = []

                            results[bot_id].append({
                                '_utime_': _utime_[i],
                                'active_goal': active_goals[i]
                            })
                            
                            last_active_goal = active_goals[i]

            log_file.visititems(visit_path)

        return results

    def taskPackets(self):
        # A dictionary mapping bot_id to an array of mission dictionaries
        results = []

        TASK_PACKET_RE = re.compile(r'jaiabot::task_packet.*;([0-9]+)')

        for log_file in self.h5Files:
            
            # Search for Command items
            for path in log_file.keys():

                m = TASK_PACKET_RE.match(path)
                if m is not None:
                    task_packet_group_path = path

                    task_packet_path = task_packet_group_path + '/jaiabot.protobuf.TaskPacket'
                    task_packets = jaialog_get_object_list(log_file[task_packet_path], repeated_members={"measurement"})

                    results += task_packets

        return results

    def getSeries(self, paths: List[str]):
        series_list = []

        paths = [path.lstrip('/') for path in paths.split(',')]

        # Get the series from the logs
        for path in paths:
            series_description = jaia_get_description(path) or {}
            invalid_values = set(series_description.get('invalid_values', []))

            series = Series()

            for log in self.h5Files:
                try:
                    series = series.extend(Series.loadFromH5File(log=log, path=path, scheme=1, invalid_values=invalid_values))
                except KeyError as e:
                    logging.warn(e)
                    continue

            series.sort()

            title = get_title_from_path(path)
            y_axis_title = title
            units = series_description.get('units')

            if units is not None:
                y_axis_title += f'\n({units})'

            series_list.append({
                'path': path,
                'title': title,
                'y_axis_title': y_axis_title,
                '_utime_': series.utime,
                'series_y': series.y_values,
                'hovertext': series.hovertext
            })

        return series_list


# Testing
if __name__ == '__main__':
    fileSet = JaiaH5FileSet(['/var/log/jaiabot/bot_offload/hub_fleet0_22350321T011042.h5'])
    print(fileSet.duration())
    print(fileSet.commands())
