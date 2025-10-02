### IMPORTS ###
import h5py
import re

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio

from pathlib import Path
from contextlib import contextmanager
from functools import reduce

### DATA ACQUISITION ###
def get_current_data(file: h5py.File):
    utime = np.array(file["/jaiabot::arduino_to_pi/jaiabot.protobuf.ArduinoResponse/_utime_"])
    current = np.array(file["/jaiabot::arduino_to_pi/jaiabot.protobuf.ArduinoResponse/vcccurrent"])
    
    df = pd.DataFrame({'utime': utime, 'current': current})
    df.attrs["file_name"] = file.filename

    return df

def get_RPM_data(file: h5py.File):
    utime = np.array(file["/jaiabot::motor_status/jaiabot.protobuf.Motor/_utime_"])
    rpm = np.array(file["/jaiabot::motor_status/jaiabot.protobuf.Motor/rpm"])
    
    df = pd.DataFrame({'utime': utime, 'rpm': rpm})
    df.attrs["file_name"] = file.filename 

    return df

def get_speedOverGround_data(file: h5py.File):
    utime = np.array(file["/jaiabot::bot_status;12/jaiabot.protobuf.BotStatus/_utime_"])
    speed = np.array(file["/jaiabot::bot_status;12/jaiabot.protobuf.BotStatus/speed/over_ground"])
    
    df = pd.DataFrame({'utime': utime, 'speed': speed})
    df.attrs["file_name"] = file.filename

    return df

def get_ph_data(file: h5py.File):
    try:
        utime = np.array(file["/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/_utime_"])
        ph = np.array(file["/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/ph"])
        ph_temperature = np.array(file["/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/temperature"])
        
        df = pd.DataFrame({'utime': utime, 'pH': ph, 'pH Temperature': ph_temperature})
        df.attrs["file_name"] = file.filename

    except:
        print(f"No PH data found for {file.filename}")
        df = pd.DataFrame()

    return df

def get_ec_data(file: h5py.File):
    utime = np.array(file["/jaiabot::salinity/jaiabot.protobuf.SalinityData/_utime_"])
    ec = np.array(file["/jaiabot::salinity/jaiabot.protobuf.SalinityData/conductivity"])
    salinity = np.array(file["/jaiabot::salinity/jaiabot.protobuf.SalinityData/salinity"])
    
    df = pd.DataFrame({'utime': utime, 'EC': ec})
    df.attrs["file_name"] = file.filename

    return df

def get_do_data(file: h5py.File):
    try:
        utime = np.array(file["/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/_utime_"])
        do = np.array(file["/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/dissolved_oxygen"])
        do_temperature = np.array(file["/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/temperature"])

        df = pd.DataFrame({'utime': utime, 'DO': do, 'DO Temperature': do_temperature})
        df.attrs["file_name"] = file.filename

    except:
        print(f"No DO data found for {file.filename}")
        df = pd.DataFrame()

    return df

def get_bar30_data(file: h5py.File):
    depth_utime = np.array(file["/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/_utime_"])
    calculated_depth = np.array(file["/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/calculated_depth"])
    df_calculated = pd.DataFrame({'utime': depth_utime, 'Calculated Depth': calculated_depth})

    raw_utime = np.array(file["/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/_utime_"])
    pressure_raw = np.array(file["/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/pressure_raw"])
    temperature = np.array(file["/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/temperature"])
    df_raw = pd.DataFrame({'utime': raw_utime, 'Bar30 Temperature': temperature, 'Raw Pressure': pressure_raw})

    df = combine_data([df_calculated, df_raw])
    df.attrs["file_name"] = file.filename

    return df

def get_task_packet_data(file: h5py.File):
    # Pattern to match full path and extract task_id
    pattern = re.compile(r"jaiabot::task_packet;(\d+)/jaiabot\.protobuf\.TaskPacket/_utime_")

    task_id = None

    def find_task_id(name):
        nonlocal task_id
        if pattern.match(name):
            task_id = pattern.match(name).group(1)
            return True  # Found it

    file.visit(find_task_id)

    if task_id is None:
        raise ValueError("No valid task_id found in the file.")

    base = f"jaiabot::task_packet;{task_id}/jaiabot.protobuf.TaskPacket"

    # Task Packet metadata
    try:
        utime = np.array(file[f"{base}/_utime_"])
        bot_id = np.array(file[f"{base}/bot_id"])
        start_time = np.array(file[f"{base}/start_time"])
        end_time = np.array(file[f"{base}/end_time"])
        type = np.array(file[f"{base}/type"])
        task_packet_df = pd.DataFrame({'utime': utime, 'Start Time': start_time, 'End Time': end_time, 'Type': type})
    except:
        print(f"No task packet data found for {file.filename}")
        task_packet_df = pd.DataFrame()
    
    # Dive
    try:
        dive_lat_start = np.array(file[f"{base}/dive/start_location/lat"])
        dive_lon_start = np.array(file[f"{base}/dive/start_location/lon"])
        depth_achieved = np.array(file[f"{base}/dive/depth_achieved"])
        bottom_dive = np.array(file[f"{base}/dive/bottom_dive"])
        dive_df = pd.DataFrame({'utime': utime, 'Dive Latitude Start': dive_lat_start, 'Dive Longitude Start': dive_lon_start, 'Depth Achieved': depth_achieved, 'Bottom Dive': bottom_dive})
    except:
        print(f"No dive data found for {file.filename}")
        dive_df = pd.DataFrame()
    
    # Drift
    try:
        drift_duration = np.array(file[f"{base}/drift/drift_duration"])
        drift_heading = np.array(file[f"{base}/drift/estimated_drift/heading"])
        drift_speed = np.array(file[f"{base}/drift/estimated_drift/speed"])
        swh = np.array(file[f"{base}/drift/significant_wave_height"])
        drift_df = pd.DataFrame({'utime': utime, 'Drift Duration': drift_duration, 'Drift Heading': drift_heading, 'Drift Speed': drift_speed, 'Significant Wave Height': swh})
    except:
        print(f"No drift data found for {file.filename}")
        drift_df = pd.DataFrame()
    
    # Combine all dataframes
    df = combine_data([task_packet_df, dive_df, drift_df])
    df.attrs["file_name"] = file.filename

    return df
    
def get_battery_data(file: h5py.File):
    utime = np.array(file["/jaiabot::battery/jaiabot.protobuf.BatteryData/_utime_"])
    battery_percentage = np.array(file["/jaiabot::battery/jaiabot.protobuf.BatteryData/percentage"])
    
    df = pd.DataFrame({'utime': utime, 'Battery Percentage': battery_percentage})
    df.attrs["file_name"] = file.filename

    return df

def get_fluor_data(file: h5py.File):
    try:
        utime = np.array(file["/jaiabot::fluorometer/jaiabot.sensor.protobuf.TurnerCFluor/_utime_"])
        concentration = np.array(file["/jaiabot::fluorometer/jaiabot.sensor.protobuf.TurnerCFluor/concentration"])

        df = pd.DataFrame({'utime': utime, 'Fluorometer Concentration': concentration})
    except:
        print(f"No fluorometer data found for {file.filename}")
        df = pd.DataFrame()

    df.attrs["file_name"] = file.filename

    return df


def get_mission_state_data(file: h5py.File):
    utime = np.array(file["/jaiabot::mission_report/jaiabot.protobuf.MissionReport/_utime_"])
    mission_state = np.array(file["/jaiabot::mission_report/jaiabot.protobuf.MissionReport/state"])
    
    df = pd.DataFrame({'utime': utime, 'Mission State': mission_state})
    df.attrs["file_name"] = file.filename

    return df

def utime_to_datetime(utime: pd.Series):
    """
    Converts a unix time in microseconds to a datetime.
    
    Args:
        utime: Input Series containing unix time in microseconds
    
    Returns:
        pandas.Series: Datetime values
    """
    return pd.to_datetime(utime, unit='us')

def datetime_to_utime(datetime: pd.Series):
    """
    Converts a datetime to unix time in microseconds.
    
    Args:
        datetime: Input Series containing datetime values
    
    Returns:
        pandas.Series: Unix time in microseconds since epoch
    """
    return datetime.astype(np.int64) // 10**3



### DATA ANALYSIS ###
def get_max_value(df: pd.DataFrame, dataset: str) -> float: #Max value of a dataset
    return df[dataset].max()

def get_min_value(df: pd.DataFrame, dataset: str) -> float: #Min value of a dataset
    return df[dataset].min()

def get_mean_value(df: pd.DataFrame, dataset: str) -> float: #Mean value of a dataset
    return df[dataset].mean()

def get_median_value(df: pd.DataFrame, dataset: str) -> float: #Median value of a dataset
    return df[dataset].median()

def get_mode_value(df: pd.DataFrame, dataset: str) -> float: #Mode of a dataset
    return df[dataset].mode()

def get_std_dev_value(df: pd.DataFrame, dataset: str) -> float: #Standard deviation of a dataset 
    return df[dataset].std()



### DATA VISUALIZATION ###
def plot_2_series(df: pd.DataFrame,
                 x_axis: str,
                 y_axis: list[str],
                 title: str = None,
                 x_label: str = None,
                 y_label: str = None) -> go.Figure:
    
    list(pio.templates)

    """
    Creates a Plotly 2D plot from a DataFrame using specified columns.
    
    Args:
        df: Input DataFrame containing the data
        x_axis: Column name to use for x-axis
        y_axis: Column name to use for y-axis
        title: Optional plot title
        x_label: Optional x-axis label (defaults to x_axis if None)
        y_label: Optional y-axis label (defaults to y_axis if None)
    
    Returns:
        Plotly Figure object
    """
    # Input validation
    if x_axis not in df.columns:
        raise ValueError(f"Column '{x_axis}' not found in DataFrame")
    for y in y_axis:
        if y not in df.columns:
            raise ValueError(f"Column '{y}' not found in DataFrame")
    
    # Create figure
    fig = go.Figure()
    
    # Add scatter plot
    for chart in y_axis:
        fig.add_trace(
            go.Scatter(
                x=df[x_axis],
                y=df[chart],
                mode='lines',
                name=chart
            )
        )
    
    # Update layout
    fig.update_layout(
        title=title or f"{y_axis} vs {x_axis}",
        xaxis_title=x_label or x_axis,
        yaxis_title=y_label or y_axis,
        template='simple_white',
        showlegend=True,
        hovermode='x unified'
    )
    
    fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='LightGray')
    fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='LightGray')
    
    fig.show()
    return fig

def plot_series_x_utime(df: pd.DataFrame,
                    y_axis: list[str],
                    title: str = None,
                    y_label: str = None) -> go.Figure:
    """
    Creates a Plotly 2D plot from a DataFrame using specified columns.
    
    Args:
        df: Input DataFrame containing the data
        x_axis: Column name to use for x-axis
        y_axis: Column name to use for y-axis
        title: Optional plot title
        x_label: Optional x-axis label (defaults to x_axis if None)
        y_label: Optional y-axis label (defaults to y_axis if None)
    
    Returns:
        Plotly Figure object
    """
    # Input validation
    for y in y_axis:
        if y not in df.columns:
            raise ValueError(f"Column '{y}' not found in DataFrame")
    
    # Create figure
    fig = go.Figure()
    
    # Add scatter plot
    for y in y_axis:
        fig.add_trace(
            go.Scatter(
                x=df['utime'],
                y=df[y],
                mode='lines',
                name=y
            )
        )
    
    # Update layout
    fig.update_layout(
        title=title or f"{y_axis} vs {'utime'}",
        xaxis_title="utime",
        yaxis_title=y_label or y_axis,
        template='simple_white',
        showlegend=True,
        hovermode='x unified'
    )
    
    fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='LightGray')
    fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='LightGray')
    
    fig.show()
    return fig 

def plot_series_x_datetime(df: pd.DataFrame,
                    y_axis: list[str],
                    title: str = None,
                    y_label: str = None) -> go.Figure:
    """
    Creates a Plotly 2D plot from a DataFrame using specified columns.
    
    Args:
        df: Input DataFrame containing the data
        x_axis: Column name to use for x-axis
        y_axis: Column name to use for y-axis
        title: Optional plot title
        x_label: Optional x-axis label (defaults to x_axis if None)
        y_label: Optional y-axis label (defaults to y_axis if None)
    
    Returns:
        Plotly Figure object
    """
    # Input validation
    for y in y_axis:
        if y not in df.columns:
            raise ValueError(f"Column '{y}' not found in DataFrame")
    
    # Create figure
    fig = go.Figure()
    
    # Add scatter plot
    for y in y_axis:
        fig.add_trace(
            go.Scatter(
                x=df['datetime'],
                y=df[y],
                mode='lines',
                name=y
            )
        )
    
    # Update layout
    fig.update_layout(
        title=title or f"{y_axis} vs {'datetime'}",
        xaxis_title="datetime",
        yaxis_title=y_label or y_axis,
        template='simple_white',
        showlegend=True,
        hovermode='x unified'
    )
    
    fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='LightGray')
    fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='LightGray')
    
    fig.show()
    return fig 



### DATA CLEANING ###

def combine_data(dataframes: list[pd.DataFrame],
                 ffill: bool = False,
                 bfill: bool = False,
                 interpolate: bool = False) -> pd.DataFrame:
    """
    Combine multiple DataFrames based on 'utime', forward-filling missing values.

    Args:
        dataframes: List of pandas DataFrames, each containing a 'utime' column.
        ffill: Forward-fill missing values.
        bfill: Back-fill missing values.
        interpolate: Interpolate missing values.

    Returns:
        Combined DataFrame aligned on 'utime' with forward-filled values.
    """
    if not dataframes:
        raise ValueError("No DataFrames provided")
    
    # Ensure all DataFrames have 'utime' as datetime
    for i, df in enumerate(dataframes):
        if 'utime' not in df.columns:
            raise ValueError(f"DataFrame at index {i} is missing 'utime' column")
    
    # Merge all DataFrames on 'utime' using outer join
    merged = reduce(lambda left, right: pd.merge(left, right, on='utime', how='outer'), dataframes)
    
    # Sort chronologically and forward-fill missing values
    merged = merged.sort_values('utime').reset_index(drop=True)
    if ffill:
        merged = merged.ffill()
    if bfill:
        merged = merged.bfill()
    if interpolate:
        merged = merged.interpolate()
    
    
    
    return merged

def generate_datetime_column(dataframes: pd.DataFrame):
    dataframes['datetime'] = pd.to_datetime(dataframes['utime'], unit='us')

    cols = dataframes.columns.tolist()
    cols[0], cols[-1] = cols[-1], cols[0]  # swap first and last
    dataframes = dataframes[cols]
    
    return dataframes

def filter_by_mission_state(dataframes: list[pd.DataFrame],
                            states: list[int]):
    """
    Args:
        dataframes: List of pandas DataFrames to filter.
        states: List of Ints representing the mission states to keep post-filtering.
    """
    


### FILE HANDLING ###
@contextmanager
def open_h5_file(file_path: Path):
    """
    Context manager for safely and efficiently handling h5py file operations.
    
    Args:
        file_path: Path to the HDF5 file
    """
    file = h5py.File(file_path, 'r')
    try:
        yield file
    finally:
        file.close()    

def get_h5_files(path: Path, recursive: bool = False) -> list[Path]:
    """
    Find .h5 files in the specified path. If path is a file, checks if it's an .h5 file.
    If path is a directory, searches for all .h5 files within it.
    
    Args:
        path (Path): Path to the file or directory to search
        recursive (bool): If True, search recursively through subdirectories (only applies to directories)
    
    Returns:
        list[Path]: List of paths to found .h5 files
    """
    # Convert string to Path object if necessary
    path = Path(path)
    h5_files = []
    
    # Check if path is a file
    if path.is_file():
        if path.suffix == '.h5':
            return [path]
        return []
    
    # If path is a directory, search for .h5 files
    if recursive:
        # rglob recursively finds all matches of the pattern
        h5_files = list(path.rglob('*.h5'))
    else:
        # glob only searches in the current directory
        h5_files = list(path.glob('*.h5'))
    
    return h5_files