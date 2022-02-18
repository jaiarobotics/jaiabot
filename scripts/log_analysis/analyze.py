#!/usr/bin/env python3

from dataclasses import dataclass
import os
import tempfile
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

    coordinates = tuple(filter(lambda p: p[0] != 0.0, zip(latitudes, longitudes)))

    # No GPS fix
    if len(coordinates) == 0:
        print('No GPS fix?')
        return

    path_string = json.dumps(coordinates)

    map_document_string = Template(open('/Users/edsanville/Sync/jaia/jaiabot/scripts/log_analysis/openstreetmaps.html.template').read()).\
        substitute(path=path_string, center_lat=coordinates[0][0], center_lon=coordinates[0][1], zoom=17)
    map_path = temppath + f'jaiabot_map.html'
    open(map_path, 'w').write(map_document_string)

    browser.open('file://' + map_path)


@dataclass
class Field:
    x_datapath: str
    y_datapath: str
    y_axis_label: str


def generate_webpage(fields, data_filenames, bdr_file):
    h5_fileset = H5FileSet(data_filenames)

    generate_map(h5_fileset)

    fig = subplots.make_subplots(rows=len(fields), cols=1, shared_xaxes=True)

    # fig.add_trace(go.Scatter(x=bdr_file.data['time'], y=bdr_file.data['Amps'], mode='lines', name='Amps'))
    # fig.add_trace(go.Scatter(x=bdr_file.data['time'], y=bdr_file.data['RPM'], mode='lines', name='RPM'), secondary_y=True)

    fig.update_layout(title='Jaiabot Data')

    for series_index, field in enumerate(fields):
        series_x = h5_fileset[field.x_datapath]
        series_y = h5_fileset[field.y_datapath]
        yaxis_title = field.y_axis_label

        fig.append_trace(go.Scatter(x=series_x.data, y=series_y.data, mode='lines', name=series_y.name), series_index + 1, 1)
        fig.update_yaxes(title_text=yaxis_title, row=series_index + 1)

    # fig.add_trace(go.Scatter(x=h5_fileset.get_series(BotStatus_time), y=h5_fileset.get_series(BotStatus_course_over_ground), mode='lines', name='BotStatus_course_over_ground'))
    # fig.add_trace(go.Scatter(x=h5_fileset.get_series(BotStatus_time), y=h5_fileset.get_series(BotStatus_salinity), mode='lines', name='BotStatus_salinity'))

    html = fig.to_html()
    html_path = temppath + f'jaiabot_chart.html'
    open(html_path, 'w').write(html)
    browser.open('file://' + html_path)


available_fields = [
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_throttle, y_axis_label='Throttle (%)'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_speed, y_axis_label='Target Speed (m/s)'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_depth, y_axis_label='Target Depth (m)'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_rudder, y_axis_label='Rudder'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_heading, y_axis_label='Target Heading (°)'),
    Field(x_datapath=RestCommand_time, y_datapath=RestCommand_timeout, y_axis_label='Timeout (s)'),

    Field(x_datapath=VehicleCommand_time, y_datapath=VehicleCommand_motor, y_axis_label='Motor (%)'),

    Field(x_datapath=PressureTemperature_time, y_datapath=PressureTemperature_pressure, y_axis_label='Pressure (mbar)'),
    Field(x_datapath=PressureTemperature_time, y_datapath=PressureTemperature_temperature, y_axis_label='Temperature (℃)'),

    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_speed_over_ground, y_axis_label='Speed over ground (m/s)'),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_course_over_ground, y_axis_label='Course over ground (°)'),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_depth, y_axis_label='Depth (m)'),
    Field(x_datapath=BotStatus_time, y_datapath=BotStatus_salinity, y_axis_label='Salinity'),
]


class DataFile:

    def __init__(self, filename) -> None:
        self.filename = filename
        date_string = filename.split('.')[-2][-15:]
        self.date = datetime.datetime.strptime(date_string, '%Y%m%dT%H%M%S')
        print(self.date)

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
            list_widget_item.setText(datafile.date.strftime('%Y-%b-%d %H:%M:%S'))
            list_widget_item.filename = datafile.filename
            file_selector_list.addItem(list_widget_item)

        self.file_selector_list = file_selector_list
        file_selector_layout.addWidget(file_selector_list)

        checkbox_layout = QVBoxLayout()

        self.field_checkboxes = []
        for field in available_fields:
            field_checkbox = QCheckBox(field.y_axis_label)
            field_checkbox.setChecked(True)
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

    def get_datafiles(self):
        datafiles = [DataFile(filename) for filename in glob.glob(os.path.expanduser('~/jaia-logs/') + '**/*_???????????????.h5', recursive=True)]
        datafiles.sort(key=lambda datafile: datafile.date, reverse=True)
        return datafiles


if __name__ == '__main__':
    app = QApplication(sys.argv)
    main_window = MainWindow()

    # bdr_file = bdr.BdrFile('/Users/edsanville/Sync/jaia/logs/bot2/bot/0/PierTest.bdr', real_datetime=datetime.datetime.fromisoformat('2022-02-16T09:30:44'), data_time_s=3742.45)

    main_window.show()
    app.exec_()
