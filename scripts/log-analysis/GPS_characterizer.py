#!/usr/bin/env python

import sys
import os
import numpy as np 
import h5py
from math import *
import datetime
import pytz
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.colors as mcolors
import pandas as pd

MICROSECOND_FACTOR = 1_000_000

"""Usage:
    Navigate to the directory containing this file, run python GPS_characterizer.py followed by the file path
    to your .h5 files in the terminal (e.g. 'python GPS_characterizer.py ~/path/to/.h5_directory/').
"""
class Point:
    """Holds the latitude and longitude of a given Point object
    
    Args:
        lat (float): Latitude of the Point
        lon (float): Longitude of the Point
    """
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon

    def __repr__(self):
        return f'({self.lat}, {self.lon})'

def round_utimes(utimes):
    """Rounds each utime in the given list of utimes to the second.
    
    Args:
        utimes (list of ints): Given list of utimes that needs to be rounded
        
    Returns:
        rounded_utimes (list of ints): Rounded list of the given utimes
    """
    utime_rounder = lambda t: round(t / MICROSECOND_FACTOR)
    rounded_utimes = np.array([utime_rounder(elem) for elem in utimes])
    return rounded_utimes

def get_tpv_idx(utime):
    """Gets the index of a given utime from the tpv_utimes list
    
    Args:
        utimes (int): The given utime used to find a tpv index
        
    Returns: 
        tpv_idx (int): Index in tpv_utimes that the given utime was first found at
    """
    tpv_idx = np.searchsorted(tpv_utimes, utime)
    return tpv_idx

def get_sky_idx(utime):
    """Gets the index of a given utime from the sky_utimes list
    
    Args:
        utimes (int): The given utime used to find a sky index
        
    Returns: 
        sky_idx (int): Index in sky_utimes that the given utime was first found at
    """
    sky_idx = np.searchsorted(sky_utimes, utime)
    return sky_idx

def get_ds_idx(utime):
    """Gets the index of a given utime from the ds_utimes list
    
    Args:
        utimes (int): The given utime used to find a ds index
        
    Returns: 
        ds_idx (int): Index in ds_utimes that the given utime was first found at
    """
    ds_idx = np.searchsorted(ds_utimes, utime)
    return ds_idx

def get_bot_idx(utime):
    """Gets the index of a given utime from the bot_utimes list
    
    Args:
        utimes (int): The given utime used to find a bot index
        
    Returns: 
        bot_idx (int): Index in ds_utimes that the given utime was first found at
    """
    bot_idx = np.searchsorted(bot_utimes, utime)
    return bot_idx

def get_rgb_from_percentage(percentage, min_percent, max_percent):
    """
    Generate colors between blue (0, 0, 255) and red (255, 0, 0) directly in RGB space.
    """
    # Normalize the percentage to a range from 0 to 1
    normalized_percentage = (percentage - min_percent) / (max_percent - min_percent) if max_percent > min_percent else 0

    # Red channel: 0 at 0% to 255 at 100%
    red = int(255 * normalized_percentage)
    
    # Blue channel: 255 at 0% to 0 at 100%
    blue = int(255 * (1 - normalized_percentage))

    # Green channel is kept at 0 to avoid passing through green or orange
    green = 0

    # Return the color in normalized RGB format
    return (red / 255, green / 255, blue / 255)


def utime_to_realtime(utime):
    """Converts a utime into a readable datetime in EST. Change desired_tz to update timezone.
    
    Args:
        utime (int): Utime to be converted
    
    Returns:
        datetime: Converted utime in EST
    """
    dt = datetime.datetime.fromtimestamp(utime, datetime.timezone.utc)    
    desired_tz = pytz.timezone('America/New_York')
    dt = dt.astimezone(desired_tz)

    return dt

#Get distances between two points using the Haversine formula
def get_distance(p1, p2):
    """Get's the distance between two points on the Earth's surface using the Haversine Formula
    
    Args:
        p1 (Point): First point to be considered
        p2 (Point): Second point to be considered
        
    Returns:
        dist (float): Distance between points p1 and p2
    """
    lat1 = p1.lat
    lon1 = p1.lon
    lat2 = p2.lat
    lon2 = p2.lon
    
    R = 6372.8 #Earth's radius in km

    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)

    a = sin(dLat/2)**2 + cos(lat1)*cos(lat2)*sin(dLon/2)**2
    c = 2*asin(sqrt(a))

    dist = round(((R * c) * 1000), 2)

    return dist #Returns distance jumped in meters

def hdop_draw_summaries(summary, data):
    """Plot the data from each bot into neat and organized Box Plots and charts
    
    Args: 
        summary (Pandas DataFrame): Contains the count, std dev, percentange, median and mean of each hdop bin
        data (Pandas DataFrame): Contains converted HDOP + distance data and formats it into columns 'HDOP' and 'dist'
        
    Returns:
        void
    """
    hdop_bins = sorted(summary['HDOP_bins'].unique())
    num_bins = len(hdop_bins)

    mask = (lats != 0.0) & (lons != 0.0)

    # Apply the mask to both arrays
    lats_filtered = lats[mask]
    lons_filtered = lons[mask]

    #Calculatimg the percent of all drifts that fall in each bin
    total_drifts = summary['count'].sum()
    summary['Percentage'] = (summary['count'] / total_drifts) * 100
    print(total_drifts)


    #Creating figure for the plots
    graph, (ax1) = plt.subplots(figsize=(20, 10))
    chart, (ax2) = plt.subplots(figsize=(16,10))    
    path, (ax3) = plt.subplots(figsize=(16, 10))

    #Box-and-whiskers plot to show the distribution and STD of the distances in each bin
    boxplot_data = [data[data['HDOP_bins'] == bin]['Drift'] for bin in hdop_bins]
    ax1.boxplot(boxplot_data,
                positions=range(len(summary)),
                widths=0.6,
                patch_artist=True,
                boxprops=dict(facecolor='lightgray'),
                medianprops=dict(color='blue', linewidth=2),
                whiskerprops=dict(color='black', linewidth=2),
                capprops=dict(color='black', linewidth=2),
                flierprops=dict(marker='o', markerfacecolor='red', markersize=3, linestyle='none'),
                labels=summary['HDOP_bins'].astype(str))
    
    #If box value would be NaN, then display "No Data" instead
    for i, (percent, count) in enumerate(zip(summary['Percentage'], summary['count'])):
        if not boxplot_data[i].empty:
            """
            highest_point = max(boxplot_data[i])
            ax1.annotate(f'{percent:.2f}%', (i, highest_point), textcoords="offset points", xytext=(0,10), ha='center')
            """
        else:
            ax1.annotate('No Data', (i, 1), textcoords="offset points", xytext=(0,10), ha='center')


    #Add error bars for standard deviation on the box plot
    for i, bin in enumerate(hdop_bins):
        bin_data = data[data['HDOP_bins'] == bin]['Drift']
        if not bin_data.empty:
            std_dev = bin_data.std()
            mean = bin_data.mean()
            percent = summary.iloc[i]['Percentage']
            min_percent = summary['Percentage'].min()
            max_percent = summary['Percentage'].max()
            color = get_rgb_from_percentage(percent, min_percent, max_percent)
            ax1.errorbar(i, mean, yerr=std_dev, fmt='o', color=color, ecolor='darkred', elinewidth=2, capsize=4, capthick=2, label='Standard Deviation' if i == 0 else None)

    #Set labels and title
    ax1.set_xlabel('HDOP Bin')
    ax1.set_ylabel('Drift Distance Dist. (m)', color='black')
    ax1.set_title('Distribution of Distances and percentage of Total Distances by HDOP Range')
    ax1.set_xticks(np.arange(num_bins))
    ax1.set_xticklabels([str(bin) for bin in hdop_bins], rotation=45, ha='right')
    ax1.set_xlim(-1, len(hdop_bins))

    #Legend for box plot
    # Create custom legend handles
    box = mpatches.Patch(color='lightgray', label='Box: Interquartile Range (IQR)')
    median = mpatches.Patch(color='blue', label='Median Line')
    whisker = mpatches.Patch(color='black', label='Whiskers: 1.5 * IQR')
    flier = mpatches.Patch(color='red', label='Outliers')
    mean_dot = mpatches.Patch(color='green', label='Mean Distance')
    mean_error_bar = mpatches.Patch(color='darkred', label='Mean ± 1 Std. Dev.')

    # Add legend to the plot
    ax1.legend(handles=[box, median, whisker, flier, mean_dot, mean_error_bar], loc='lower right', bbox_to_anchor=(1, 0.5))

    #Create summary table to display data textually
    cell_text = []
    custom_cols = ['HDOP Range', 'Average Dist. per Drift (m)', 'Std Dev of Drifts (m)', 'Median Drift', 'Total Surface Drifts', 'Percentage of Total Drifts']
    columns = ['HDOP_bins', 'average_drift', 'std_dev_drift', 'median_drift', 'count', 'Percentage']
    for row in summary.itertuples(index=False):
        row_data = [getattr(row, col) if pd.notna(getattr(row, col)) else '-' for col in columns]
        cell_text.append(row_data)

    #Display table
    table = ax2.table(cellText=cell_text, colLabels=custom_cols, loc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2)
    ax2.axis('off')

    #Display bot path
    graph.suptitle(f'Bot {bot_id} HDOP Analysis\n{filename}', fontsize=16)
    plt.tight_layout()
    #plt.show()

    chart.suptitle(f'Bot {bot_id} HDOP Analysis\n{filename}', fontsize=16)
    #plt.show()
    
    print(final_data.tail())
    print(final_data['Longitude'].tail())
    print(final_data['Latitude'].tail())
    print(final_data['State'].tail())

    print(final_data.shape)
    print(final_data['Longitude'].shape)
    print(final_data['Latitude'].shape)
    print(final_data['State'].shape)
    
    scatter = plt.scatter(final_data['Longitude'], final_data['Latitude'], c=final_data['Color'], s=1, alpha=0.5)
    ax3.set_title(f'Path of Bot {bot_id}\n{filename}')
    ax3.set_xlabel('Longitude')
    ax3.set_ylabel('Latitude')
    ax3.grid(True)
    #plt.show()

    plt.show()

def get_plot_data():
    """Finds and calculates the data necessary for analysis. Calls hdop_draw_summaries().
    
    Args:
        void
        
    Returns:
        void
    """
    hdop_data = pd.DataFrame(hdop_dist, columns=['HDOP', 'Drift'])
    pdop_data = pd.DataFrame(pdop_dist, columns=['PDOP', 'Drift'])

    #Min/Max in each HDOP/PDOP range
    min_hdop = 0
    max_hdop = hdop_data['HDOP'].max()
    min_pdop = 0
    max_pdop = pdop_data['PDOP'].max()
    hdop_bin_edges = np.arange(min_hdop, max_hdop + bin_width, bin_width)
    pdop_bin_edges = np.arange(min_pdop, max_pdop + bin_width, bin_width)

    hdop_data['HDOP_bins'] = pd.cut(hdop_data['HDOP'], bins=hdop_bin_edges)
    pdop_data['PDOP_bins'] = pd.cut(pdop_data['PDOP'], bins=pdop_bin_edges)

    hdop_summary_per_bin = hdop_data.groupby('HDOP_bins').agg(
        count = ('HDOP', 'count'),
        std_dev_drift = ('Drift', 'std'),
        median_drift = ('Drift', 'median'),
        average_drift = ('Drift', 'mean'),
    ).reset_index()

    pdop_summary_per_bin = pdop_data.groupby('PDOP_bins').agg(
        count = ('PDOP', 'count'),
        std_dev_drift = ('Drift', 'std'),
        median_drift = ('Drift', 'median'),
        average_drift = ('Drift', 'mean')
    ).reset_index()

    average_drift_per_bin_hdop = hdop_data.groupby('HDOP_bins')['Drift'].mean().reset_index()
    average_drift_per_bin_pdop = pdop_data.groupby('PDOP_bins')['Drift'].mean().reset_index()
    
    average_drift_per_bin_hdop.columns = ['HDOP_Bin', 'Average Drift']
    average_drift_per_bin_pdop.columns = ['PDOP_Bin', 'Average Drift']

    # Min/Max in each HDOP/PDOP range
    min_hdop = hdop_data['HDOP'].min()
    max_hdop = hdop_data['HDOP'].max()
    min_pdop = pdop_data['PDOP'].min()
    max_pdop = pdop_data['PDOP'].max()

    print(f"HDOP Range: {min_hdop} to {max_hdop}")
    print(f"PDOP Range: {min_pdop} to {max_pdop}")

    hdop_draw_summaries(hdop_summary_per_bin, hdop_data)

def get_data(directory):
    """Loops through all the .h5 files in a directory and organizes the necessary data for analysis in get_plot_data().
    
    Args:
        directory (string): Path to the directory containing .h5 files to be analyzed.
        
    Returns:
        void
    """
    global filename
    for filename in os.listdir(directory):
        if filename.endswith('.h5'): 
            global lats
            global lons
            global bots_lats
            global bots_lons
            global tpv_utimes
            global hdops
            global pdops
            global nsats
            global sky_utimes
            global bot_id
            global ds_utimes
            global bot_utimes
            global hdop_dist
            global pdop_dist
            global final_data

            file_path = os.path.join(directory, filename)

            with h5py.File(file_path, 'r') as file:
                tpv = file["/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity"] #Time, Position, Velocity data
                sky = file["/goby::middleware::groups::gpsd::sky/goby.middleware.protobuf.gpsd.SkyView"] #Sky view data
                bot_status = file["jaiabot::bot_status;0/jaiabot.protobuf.BotStatus"] #Bot_status data
                bot_id = file["jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/bot_id"][0] #Bot ID of the current file
                desired_setpoints = file["jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints"] #Desired-setpoints data

                #Desried_setpoints data
                ds_utimes = np.array(desired_setpoints['_utime_'])

                #bot_status data
                states = np.array(bot_status['mission_state'])
                bot_utimes = np.array(bot_status['_utime_'])
                bots_lats = np.array(bot_status['location/lat'])
                bots_lons = np.array(bot_status['location/lon'])

                #TPV data
                lats = np.array(tpv['location/lat'])
                lons = np.array(tpv['location/lon'])
                tpv_utimes = np.array(tpv['_utime_'])

                #Sky data
                hdops = np.array(sky['hdop'])
                pdops = np.array(sky['pdop'])
                nsats = np.array(sky['nsat'])
                sky_utimes = np.array(sky['_utime_'])

                #Round all utimes to the nearest second
                ds_utimes = round_utimes(ds_utimes)
                tpv_utimes = round_utimes(tpv_utimes)
                sky_utimes = round_utimes(sky_utimes)
                bot_utimes = round_utimes(bot_utimes)
                
                hdop_dist = []
                pdop_dist = []

                #Merge lats, lons, and states
                lats_series = pd.Series(lats, index=tpv_utimes)
                lons_series = pd.Series(lons, index=tpv_utimes)
                states_series = pd.Series(states, index=bot_utimes)
                
                states_series.name = 'State'
                lats_series = lats_series.rename('Latitude')
                lons_series = lons_series.rename('Longitude')

                lat_df = lats_series.to_frame()
                lon_df = lons_series.to_frame()

                lat_lon_df = lat_df.join(lon_df, how='outer')

                merged_data = pd.merge_asof(states_series.sort_index(), lat_lon_df.sort_index(), left_index=True, right_index=True, direction='nearest', tolerance=1)

                cleaned_data = merged_data[(merged_data['Latitude'] != 0.0) & (merged_data['Longitude'] != 0.0)]
                final_data = cleaned_data.drop_duplicates()
                final_data['Color'] = final_data['State'].apply(lambda x: 'red' if x == 111 or x == 114 or x == 115 or x == 121 or x == 122 or x == 128 or x == 129 or x == 143 else 'blue')


                #Loop through all tpv values
                i = 0
                while i < len(tpv_utimes):
                    bot_idx = get_bot_idx(tpv_utimes[i])
                    if bot_idx >= len(bot_utimes):
                        break

                    #Looks at all SURFACE_DRIFT states (114, 121, 129) and REACQUIRE_GPS states (111, 115, 122, 128, 143)
                    if states[bot_idx] == 111 or states[bot_idx] == 114 or states[bot_idx] == 115 or states[bot_idx] == 121 or states[bot_idx] == 122 or states[bot_idx] == 128 or states[bot_idx] == 129 or states[bot_idx] == 143: 
                        bot_idx = get_bot_idx(bot_utimes[bot_idx] + 10) #Skip the first 10 seconds of the drift
                        #bot_idx_plus_1 = get_bot_idx(bot_utimes[bot_idx] + 1)
                        sky_idx = get_sky_idx(tpv_utimes[i])
                        new_tpv_index = get_tpv_idx(tpv_utimes[i] + 10) #Skip past the first 10 seconds of the drift

                        if new_tpv_index + 1 < len(tpv_utimes):
                            p1 = Point(lats[new_tpv_index], lons[new_tpv_index]) #Start point of the drift
                            p2 = Point(lats[new_tpv_index + 1], lons[new_tpv_index + 1]) #Next point in the drift
                        else:
                            break

                        #Filter out bad data
                        if hdops[sky_idx] == 99.99 or p1.lat == 0.0 or p1.lon == 0.0 or p2.lat == 0.0 or p2.lon == 0.0:
                            i += 1
                            continue
                        
                        dist = get_distance(p1, p2)

                        #If the distance drifted is greater than the current drift_tolerance, then record the drift
                        if (dist >= drift_tolerance):
                            hdop_dist.append((hdops[sky_idx], dist))
                            pdop_dist.append((pdops[sky_idx], dist))

                    """
                        #Increment past the current drift
                        i += j
                    else:
                        i += 1
                    """
                    i += 1

                #Calls to display the data neatly and resets data series
                if len(pdop_dist) and len(hdop_dist):
                    get_plot_data()
                    hdop_dist = []
                    pdop_dist = []

def main():
    global bin_width
    global hdop_tolerance
    global pdop_tolerance
    global nsat_tolerance
    global drift_tolerance 
    global desired_speed_tolerance
    
    bin_width = 0.5
    drift_tolerance = 0 #Meters
    desired_speed_tolerance = 0
    hdop_tolerance = 1.3
    pdop_tolerance = 1.5
    nsat_tolerance = 1
    

    argc = len(sys.argv)
    input_dir = sys.argv[1]

    #Get user input
    if argc >= 3:
        bin_width = float(sys.argv[2])
    if argc >= 4:
        drift_tolerance = float(sys.argv[3])
    if argc >= 5:
        desired_speed_tolerance = float(sys.argv[4])
    if argc >= 6:
        hdop_tolerance = float(sys.argv[5])
    if argc >= 7:
        pdop_tolerance = float(sys.argv[6])
    if argc == 8:
        nsat_tolerance = int(sys.argv[7])
        
    get_data(input_dir)

if __name__ == "__main__":
    main()