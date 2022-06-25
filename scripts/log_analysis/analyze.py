#!/usr/bin/env python3

from dataclasses import dataclass
from datetime import tzinfo
import os
import tempfile
from time import tzname
from typing import Callable
import webbrowser
from dateutil.parser import parse
import argparse
from numpy import array
import plotly.graph_objects as go
from pathlib import Path
import PyQt5
from PyQt5.QtWidgets import *
import sys
import bdr
import plotly.subplots as subplots
from h5 import *
import random
import json
from string import Template
import numpy as np
import glob

from copy import deepcopy

try:
    selectedFieldsPath = os.path.expanduser('~/.jaia_analyzer_selected_fields.json')
    selectedFields = json.load(open(selectedFieldsPath))
except:
    selectedFields = []

def saveSelectedFields():
    json.dump(selectedFields, open(selectedFieldsPath, 'w'))

browser = webbrowser.get()
tempdir = tempfile.TemporaryDirectory()
temppath = tempdir.name + '/'

def process_goby_to_hdf5(goby_filename):
    goby_path = Path(goby_filename)
    h5_path = Path(goby_path.parent, goby_path.stem + '.h5')

    if not h5_path.is_file():
        cmd = f'goby_log_tool --input_file {goby_path.absolute()} --output_file {h5_path.absolute()} --format HDF5'
        print('  > ', cmd)
        os.system(cmd)

    return h5_path.absolute()


def generate_map(h5_fileset):
    time_series = h5_fileset[TPV_time]
    if time_series is None:
        print('No GPS fix?')
        return {
            'points': '[ ]',
            'path': '[ ]',
            'center_lat': 0,
            'center_lon': 0,
            'zoom': 1,
        }

    times = h5_fileset[TPV_time].data
    latitudes = h5_fileset[TPV_lat].data
    longitudes = h5_fileset[TPV_lon].data

    # Divide the segments up on the map
    points = []
    path = []
    path_section = []
    center_lat = None
    center_lon = None

    for pt_index in range(0, len(latitudes)):
        time = times[pt_index]
        latitude = latitudes[pt_index]
        longitude = longitudes[pt_index]

        # Setup a sorted flat array for figuring out where to plot the location indicator icon when hovering in plotly
        if time and latitude and longitude:
            points.append([datetime.datetime.timestamp(time), latitude, longitude])

        if latitude and longitude:
            if center_lat is None:
                center_lat = latitude
                center_lon = longitude

            path_section.append((latitude, longitude))
        else:
            if len(path_section) > 0:
                path.append(path_section)
                path_section = []

    points.sort(key=lambda pt: pt[0])

    coordinates = tuple(filter(lambda p: p[0] != 0.0, zip(latitudes, longitudes)))

    path_string = json.dumps(path)

    return {
        'points': points,
        'path': path_string,
        'center_lat': center_lat,
        'center_lon': center_lon,
        'zoom': 17,
    }


@dataclass
class Field:
    y_datapath_re: str
    y_axis_label: str


def generate_webpage(fields, data_filenames, bdr_file):
    h5_fileset = H5FileSet(data_filenames)

    substitution_dict = generate_map(h5_fileset)

    fig = subplots.make_subplots(rows=len(fields), cols=1, shared_xaxes=True)

    # fig.add_trace(go.Scatter(x=bdr_file.data['time'], y=bdr_file.data['Amps'], mode='lines', name='Amps'))
    # fig.add_trace(go.Scatter(x=bdr_file.data['time'], y=bdr_file.data['RPM'], mode='lines', name='RPM'), secondary_y=True)

    display_filenames = ', '.join([os.path.basename(full_filename) for full_filename in data_filenames])

    fig.update_layout(title=f'JaiaData - {display_filenames}', hovermode="closest")

    for series_index, field in enumerate(fields):
        y_datapath = h5_fileset.find_datapath_re(field.y_datapath_re)

        if y_datapath is None:
            continue

        trunk_path = '/'.join(y_datapath.split('/')[:2])
        scheme_path = trunk_path + '/_scheme_'
        x_datapath = trunk_path + '/_utime_'

        # Pass if we don't have this series
        if h5_fileset[scheme_path] is None:
            continue

        series_scheme = h5_fileset[scheme_path].data
        series_x = deepcopy(h5_fileset[x_datapath])
        series_y = deepcopy(h5_fileset[y_datapath])

        # Die if we don't have a series
        if series_x is None or series_y is None:
            continue

        series_x_data = []
        series_y_data = []
        hovertext = None

        # If we're dealing with an enum, we need a hovertext list
        try:
            enum_dict = h5_fileset.check_enum_dtype(y_datapath)
        except KeyError:
            continue

        if enum_dict:
            hovertext = []

        # Get the maximum value for this field, (which will represent a missing value)
        try:
            MISSING = np.iinfo(series_y.dtype).max
        except ValueError:
            MISSING = np.finfo(series_y.dtype).max


        for i in range(0, len(series_x.data)):
            # Keep it to scheme == 1
            if series_scheme and series_scheme[i] != 1:
                continue

            # Throw out missing values
            if series_y.data[i] == MISSING:
                continue

            # Ensure the enum is a valid value
            if enum_dict and series_y.data[i] not in enum_dict:
                continue

            series_x_data.append(series_x.data[i])
            series_y_data.append(series_y.data[i])

            if enum_dict:
                hovertext.append(enum_dict[series_y.data[i]])
            
        yaxis_title = field.y_axis_label

        fig.append_trace(go.Scatter(x=series_x_data, y=series_y_data, mode='lines+markers', name=series_y.name, connectgaps=False, hovertext=hovertext), series_index + 1, 1)
        fig.update_yaxes(title_text=yaxis_title, row=series_index + 1)

    substitution_dict['page_title'] = display_filenames
    substitution_dict['charts_div'] = fig.to_html(include_plotlyjs=False, full_html=False)

    document_string = Template(open('./analysis.html.template').read()).\
        substitute(substitution_dict)
    path = temppath + f'analysis.html'
    open(path, 'w').write(document_string)

    browser.open('file://' + path)


available_fields = [
    Field(y_datapath_re=PIDControl_throttle, y_axis_label='Manual Throttle (%)'),
    Field(y_datapath_re=PIDControl_speed, y_axis_label='Target Speed (m/s)'),
    Field(y_datapath_re=PIDControl_depth, y_axis_label='Target Depth (m)'),
    Field(y_datapath_re=PIDControl_rudder, y_axis_label='Manual Rudder'),
    Field(y_datapath_re=PIDControl_heading, y_axis_label='Target Heading (°)'),
    Field(y_datapath_re=PIDControl_timeout, y_axis_label='Timeout (s)'),

    Field(y_datapath_re=LowControl_motor, y_axis_label='Motor (%)'),
    Field(y_datapath_re=LowControl_rudder, y_axis_label='Rudder'),

    Field(y_datapath_re=PressureTemperature_pressure, y_axis_label='Pressure (mbar)'),
    Field(y_datapath_re=PressureTemperature_temperature, y_axis_label='Temperature (℃)'),

    Field(y_datapath_re=BotStatus_speed_over_ground, y_axis_label='Speed over ground (m/s)'),
    Field(y_datapath_re=BotStatus_attitude_heading, y_axis_label='Heading (°)'),
    Field(y_datapath_re=BotStatus_course_over_ground, y_axis_label='Course over ground (°)'),
    Field(y_datapath_re=BotStatus_depth, y_axis_label='Depth (m)'),
    Field(y_datapath_re=BotStatus_salinity, y_axis_label='Salinity'),
    Field(y_datapath_re=BotStatus_mission_state, y_axis_label='Mission state'),
    Field(y_datapath_re=BotStatus_latitude, y_axis_label='BotStatus latitude (°)'),
    Field(y_datapath_re=BotStatus_longitude, y_axis_label='BotStatus longitude (°)'),

    Field(y_datapath_re=DesiredCourse_speed, y_axis_label='Desired speed (m/s)'),
    Field(y_datapath_re=DesiredCourse_heading, y_axis_label='Desired heading (°)'),

    Field(y_datapath_re=DesiredSetpoints_dive_depth, y_axis_label='Dive depth (m)'),
    Field(y_datapath_re=DesiredSetpoints_type, y_axis_label='Desired Setpoint Type'),

    Field(y_datapath_re=PIDControl_depth_Kp, y_axis_label='Depth P gain'),
    Field(y_datapath_re=PIDControl_depth_Ki, y_axis_label='Depth I gain'),
    Field(y_datapath_re=PIDControl_depth_Kd, y_axis_label='Depth D gain'),

    Field(y_datapath_re=TPV_lat, y_axis_label='Latitude (°)'),
    Field(y_datapath_re=TPV_lon, y_axis_label='Longitude (°)'),
    Field(y_datapath_re=TPV_epx, y_axis_label='Longitude Error 95% (m)'),
    Field(y_datapath_re=TPV_epy, y_axis_label='Latitude Error 95% (m)'),
    Field(y_datapath_re=TPV_epv, y_axis_label='Vertical Error 95% (m)'),

    Field(y_datapath_re=Engineering_flag, y_axis_label='Flag Event'),

    Field(y_datapath_re=ArduinoCommand_motor, y_axis_label='Arduino motor (microsec)'),

    Field(y_datapath_re=HUBCommand_type, y_axis_label='HUB Command type')
]


class DataFile:

    def __init__(self, filename) -> None:
        self.filename = filename
        date_string = filename.split('.')[-2][-15:]
        self.date = datetime.datetime.strptime(date_string, '%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)

log_root_path = os.path.expanduser('~/jaia-logs/')

class MainWindow(QWidget):

    def __init__(self, parent = None):
        super(MainWindow, self).__init__(parent)

        self.setWindowTitle("JaiaBot Analyzer")

        layout = QHBoxLayout()

        file_selector_layout = QVBoxLayout()

        file_selector_list = QListWidget()
        file_selector_list.setSelectionMode(2)
        self.file_selector_list = file_selector_list
        file_selector_layout.addWidget(file_selector_list)

        self.load_file_list()

        self.unselect_all_files_button = QPushButton()
        self.unselect_all_files_button.setText('Unselect All Files')
        self.unselect_all_files_button.clicked.connect(self.unselect_all_files)
        file_selector_layout.addWidget(self.unselect_all_files_button)

        self.reload_file_list_button = QPushButton()
        self.reload_file_list_button.setText('Reload File List')
        self.reload_file_list_button.clicked.connect(self.load_file_list)
        file_selector_layout.addWidget(self.reload_file_list_button)

        layout.addLayout(file_selector_layout)
        layout.addLayout(self.checkbox_layout())

        self.setLayout(layout)

    def checkbox_layout(self):
        checkbox_layout = QVBoxLayout()

        self.field_checkboxes = []
        for field in available_fields:
            field_checkbox = QCheckBox(field.y_axis_label)
            field_checkbox.setChecked(field.y_axis_label in selectedFields)
            field_checkbox.field = field
            
            self.field_checkboxes.append(field_checkbox)
            checkbox_layout.addWidget(field_checkbox)

        open_button = QPushButton()
        open_button.setText('Open Files')
        open_button.clicked.connect(self.open_files)
        checkbox_layout.addWidget(open_button)

        return checkbox_layout

    def open_files(self):
        global selectedFields
        checked_checkboxes = list(filter(lambda checkbox: checkbox.isChecked(), self.field_checkboxes))
        selectedFields = [checkbox.text() for checkbox in checked_checkboxes]
        saveSelectedFields()
        fields = [checkbox.field for checkbox in checked_checkboxes]

        data_filenames = [item.filename for item in self.file_selector_list.selectedItems()]

        if len(data_filenames) == 0:
            alert = QMessageBox()
            alert.setText('No files selected')
            alert.setInformativeText('Please select at least one file.')
            alert.exec()
            return

        print('Opening files: ', data_filenames)

        generate_webpage(fields, data_filenames, None)

    def unselect_all_files(self):
        # Unselect all files
        self.file_selector_list.clearSelection()

    def load_file_list(self):
        self.datafiles = self.get_datafiles()

        self.file_selector_list.clear()

        # Add the file selector
        for datafile in self.datafiles:
            list_widget_item = QListWidgetItem(self.file_selector_list)
            local_datetime = datafile.date.astimezone()
            
            file_modification_time_string = local_datetime.strftime(f'%Y %b %d %a %-I:%M:%S %p')
            display_filename = os.path.basename(datafile.filename)

            list_widget_item.setText(f'{file_modification_time_string}  {display_filename}')
            list_widget_item.filename = datafile.filename
            self.file_selector_list.addItem(list_widget_item)

    def get_datafiles(self):
        datafiles = [DataFile(filename) for filename in glob.glob(log_root_path + '**/*_???????????????.h5', recursive=True)]

        datafiles.sort(key=lambda datafile: os.path.getmtime(datafile.filename), reverse=True)
        return datafiles


if __name__ == '__main__':
    app = QApplication(sys.argv)
    main_window = MainWindow()
    main_window.setFixedWidth(1280)
    main_window.setFixedHeight(960)

    main_window.show()
    app.exec_()
