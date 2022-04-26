#!/usr/bin/env python3

from dataclasses import dataclass
from datetime import tzinfo
import os
import tempfile
from time import tzname
import webbrowser
from dateutil.parser import parse
import argparse
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
import glob

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
    times = h5_fileset[BotStatus_time].data
    latitudes = h5_fileset[BotStatus_latitude].data
    longitudes = h5_fileset[BotStatus_longitude].data

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

    # No GPS fix
    if len(path) == 0:
        print('No GPS fix?')
        return {
            'points': '[ ]',
            'path': '[ ]',
            'center_lat': 0,
            'center_lon': 0,
            'zoom': 1,
        }

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
    x_datapath: str
    y_datapath: str
    y_axis_label: str
    default_on: bool = False


def generate_webpage(fields, data_filenames, bdr_file):
    h5_fileset = H5FileSet(data_filenames)

    substitution_dict = generate_map(h5_fileset)

    fig = subplots.make_subplots(rows=len(fields), cols=1, shared_xaxes=True)

    # fig.add_trace(go.Scatter(x=bdr_file.data['time'], y=bdr_file.data['Amps'], mode='lines', name='Amps'))
    # fig.add_trace(go.Scatter(x=bdr_file.data['time'], y=bdr_file.data['RPM'], mode='lines', name='RPM'), secondary_y=True)

    fig.update_layout(title='Jaiabot Data', hovermode="closest")

    for series_index, field in enumerate(fields):
        series_x = h5_fileset[field.x_datapath]
        series_y = h5_fileset[field.y_datapath]
        yaxis_title = field.y_axis_label

        fig.append_trace(go.Scatter(x=series_x.data, y=series_y.data, mode='lines', name=series_y.name, connectgaps=False), series_index + 1, 1)
        fig.update_yaxes(title_text=yaxis_title, row=series_index + 1)

    substitution_dict['charts_div'] = fig.to_html(include_plotlyjs=False, full_html=False)

    document_string = Template(open('./analysis.html.template').read()).\
        substitute(substitution_dict)
    path = temppath + f'analysis.html'
    open(path, 'w').write(document_string)

    browser.open('file://' + path)


available_fields = [
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_throttle, y_axis_label='Throttle (%)', default_on=True),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_speed, y_axis_label='Target Speed (m/s)', default_on=True),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_depth, y_axis_label='Target Depth (m)'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_rudder, y_axis_label='Rudder'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_heading, y_axis_label='Target Heading (°)'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_timeout, y_axis_label='Timeout (s)'),

    Field(x_datapath=VehicleCommand_time, y_datapath=VehicleCommand_motor, y_axis_label='Motor (%)', default_on=True),

    Field(x_datapath=PressureTemperature_time, y_datapath=PressureTemperature_pressure, y_axis_label='Pressure (mbar)'),
    Field(x_datapath=PressureTemperature_time, y_datapath=PressureTemperature_temperature, y_axis_label='Temperature (℃)'),

    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_speed_over_ground, y_axis_label='Speed over ground (m/s)'),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_course_over_ground, y_axis_label='Course over ground (°)'),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_depth, y_axis_label='Depth (m)', default_on=True),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_salinity, y_axis_label='Salinity'),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_mission_state, y_axis_label='Mission state'),

    Field(x_datapath=DesiredCourse_time, y_datapath=DesiredCourse_speed, y_axis_label='Desired speed (m/s)'),
    Field(x_datapath=DesiredCourse_time, y_datapath=DesiredCourse_heading, y_axis_label='Desired heading (°)'),

    Field(x_datapath=DesiredSetpoints_time, y_datapath=DesiredSetpoints_dive_depth, y_axis_label='Dive depth (m)'),
]


class DataFile:

    def __init__(self, filename) -> None:
        self.filename = filename
        date_string = filename.split('.')[-2][-15:]
        self.date = datetime.datetime.strptime(date_string, '%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)

class MainWindow(QWidget):

    def __init__(self, parent = None):
        super(MainWindow, self).__init__(parent)

        self.setWindowTitle("JaiaBot Analyzer")

        layout = QHBoxLayout()

        file_selector_layout = QVBoxLayout()

        self.datafiles = self.get_datafiles()

        file_selector_list = QListWidget()
        file_selector_list.setSelectionMode(2)

        for datafile in self.datafiles:
            list_widget_item = QListWidgetItem(file_selector_list)
            local_datetime = datafile.date.astimezone()
            list_widget_item.setText(local_datetime.strftime('%Y %b %d %a %-I:%M:%S %p'))
            list_widget_item.filename = datafile.filename
            file_selector_list.addItem(list_widget_item)

        self.file_selector_list = file_selector_list

        self.unselect_all_files_button = QPushButton()
        self.unselect_all_files_button.setText('Unselect All Files')
        self.unselect_all_files_button.clicked.connect(self.unselect_all_files)

        file_selector_layout.addWidget(file_selector_list)
        file_selector_layout.addWidget(self.unselect_all_files_button)

        checkbox_layout = QVBoxLayout()

        self.field_checkboxes = []
        for field in available_fields:
            field_checkbox = QCheckBox(field.y_axis_label)
            field_checkbox.setChecked(field.default_on)
            field_checkbox.field = field
            self.field_checkboxes.append(field_checkbox)
            checkbox_layout.addWidget(field_checkbox)

        open_button = QPushButton()
        open_button.setText('Open Files')
        open_button.clicked.connect(self.open_files)
        checkbox_layout.addWidget(open_button)

        layout.addLayout(file_selector_layout)
        layout.addLayout(checkbox_layout)

        self.setLayout(layout)

    def open_files(self):
        fields = [checkbox.field for checkbox in filter(lambda checkbox: checkbox.isChecked(), self.field_checkboxes)]
        
        data_filenames = [item.filename for item in self.file_selector_list.selectedItems()]

        generate_webpage(fields, data_filenames, None)

        # Unselect all files
        self.file_selector_list.clearSelection()

    def unselect_all_files(self):
        # Unselect all files
        self.file_selector_list.clearSelection()

    def get_datafiles(self):
        datafiles = [DataFile(filename) for filename in glob.glob(os.path.expanduser('~/jaia-logs/') + '**/*_???????????????.h5', recursive=True)]
        datafiles.sort(key=lambda datafile: datafile.date, reverse=True)
        return datafiles


if __name__ == '__main__':
    app = QApplication(sys.argv)
    main_window = MainWindow()
    main_window.setFixedWidth(1280)
    main_window.setFixedHeight(960)

    main_window.show()
    app.exec_()
