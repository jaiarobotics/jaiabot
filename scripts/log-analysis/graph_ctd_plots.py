import h5py
import argparse 
import os

import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

from pathlib import Path
from plotly.subplots import make_subplots

""" Usage:

        - In a terminal, navigate to the directory containing this script and run the following commands.
            - pip install -r requirements.txt
            - python3 graph_ctd_plots.py </path/to/h5_files/>

    Flags:
        -r: Recursively search through the given input directory.
"""

def get_file_list(path, recursive): 
    """ Gets list of files to analyze.

        Uses the user input path to a directory or file and either returns a single file, 
        all .h5 files within the given directory, or all .h5 files within all subdirectories, 
        depending on input of the '-r' flag at runtime. 

        Args:
            path (str): Path to either an h5 or directory containing h5 files.
            recursive (bool): Whether the user wants to search recursively through subdirectories or not.
            
        Returns:
            list[pathlib.PosixPath]: List containing all h5 files within the specified file location(s)
    """

    lst = []
    if os.path.isdir(path):
        if recursive:
            lst = list(Path(path).rglob('*.h5'))
        else:
            lst =  list(Path(path).glob('*.h5'))
    elif os.path.isfile(path) and path.endswith('.h5'):
        lst = [path]
    
    if len(lst) == 0:
        print("------------\nERROR: File or Directory does not exist or does not contain an h5 format file. Try again.\n------------")

    return lst

def get_data(file_list):
    """ Retrieves all the requedsted data from the users' input files.
    
        Loops through the given file list of h5 files and pulls out the salinity, temperature, and depth (CTD) data from the 
        log file. Returns a list of dataframes containing all of this data. 

        Args:
            file_list (list[pathlib.PosixPath]): List containing 

        Returns:
            list[dict]: List of dictionaries with each dictionary containing the CTD and log data (bot ID, fleet number, time, etc...).
    """

    all_data = []
    for filename in file_list:
        file_data = {}
        with h5py.File(filename, 'r') as file:

            # Salinity data
            salinity = pd.Series(file["jaiabot::salinity/jaiabot.protobuf.SalinityData/salinity"], name='salinity')
            salinity_utime = pd.Series(file["jaiabot::salinity/jaiabot.protobuf.SalinityData/_utime_"], name='salinity_utime')
            salinity_datetime = pd.to_datetime(salinity_utime, unit='us', origin='unix', utc=True).dt.tz_convert('America/New_York')
            salinity_frame = {'time': salinity_datetime,
                              'salinity': salinity }
            salinity_df = pd.DataFrame(salinity_frame)
    
            # Temperature data
            temperature = pd.Series(file["jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/temperature"], name='temperature')
            temperature_utime = pd.Series(file["jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/_utime_"], name='temperature_utime')
            temperature_datetime = pd.to_datetime(temperature_utime, unit='us', origin='unix', utc=True).dt.tz_convert('America/New_York')
            temp_frame = {'time': temperature_datetime,
                          'temperature': temperature}
            temperature_df = pd.DataFrame(temp_frame)
            
            # Depth data
            depth = pd.Series(file["jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/calculated_depth"], name='depth')
            depth_utime = pd.Series(file["jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/_utime_"], name='depth_utime')
            depth_datetime = pd.to_datetime(depth_utime, unit='us', origin='unix', utc=True).dt.tz_convert('America/New_York')
            depth_frame = {'time': depth_datetime,
                           'depth': depth}
            depth_df = pd.DataFrame(depth_frame)

            # Log information
            bot_id = file["goby::configuration/jaiabot.config.MissionManager/bot_id"][0]
            str_filename = str(filename).split('_')
            fleet = str_filename[-2][5:]
            log_date = pd.to_datetime(depth_utime, unit='us', origin='unix', utc=True).dt.tz_convert('America/New_York')[0]
            log_date = log_date.round(freq="s")

            # Adding new data from each log to a new file_data dictionary to eventually be returned
            file_data['salinity'] = salinity_df
            file_data['temperature'] = temperature_df
            file_data['depth'] = depth_df
            file_data['filename'] = f"Bot {bot_id} Fleet {fleet} {log_date}"
    
        # Adding file specific data to larger directory wide data list
        all_data.append(file_data)
    
    return all_data

def graph_data(all_data):
    """ Graphs CTD data onto Data x Time plots
    
        Loops through all the CTD data gathered from get_data() and uses Plotly scatter plots to display the data from each
        file in a new browser window. Should automatically open new window showing the graphs. 
        
        Args: 
            all_data (list(dict[]): List of dictionaries with each dictionary containing the CTD data from a seperate log file.
            
        Returns: 
            None
    """

    for file_data in all_data:
        filename = file_data['filename']
        salinity = file_data['salinity']
        temperature = file_data['temperature']
        depth = file_data['depth']

        # New window containing all subplots
        fig = make_subplots(rows=2, cols=2, subplot_titles=("Salinity", "Temperature", "Depth"))

        # Salinity plot
        fig.add_trace(
            go.Scatter(
                x=salinity['time'], 
                y=salinity['salinity'],   
                name="Salinity"
            ),
            row=1,
            col=1,
        ),

        # Temperature plot
        fig.add_trace(
            go.Scatter( 
                x=temperature['time'], 
                y=temperature['temperature'],
                name="Temperature"
            ),
            row=1,
            col=2,
        ),

        # Depth plot
        fig.add_trace(
            go.Scatter( 
                x=depth['time'], 
                y=depth['depth'],
                name="Depth"
            ),
            row=2,
            col=1,
        )
        
        fig.update_layout(title_text=f"CTD Plots for {filename}", title_x=0.5)
        fig.show()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Dynamically allow users to parse through a series of datafiles.')
    parser.add_argument("path", type=str, help="Path to directory .h5 file.")
    parser.add_argument("-r", "--recursive", action="store_true", help="Recursively find all .h5 files in a directory and all of its subdirectories.")
    args = parser.parse_args()

    file_list = get_file_list(args.path, args.recursive)
    all_data = get_data(file_list)
    graph_data(all_data)
