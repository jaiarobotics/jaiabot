import pandas as pd 
import numpy as np
import h5py
import argparse
import os
import sys
import re

from pathlib import Path
from datetime import datetime
# import sortedcontainers
from sortedcontainers import SortedDict

"""

Usage:
- Navigate to the directory this script is saved in.
- In a terminal, run python3 pass_checkout_tests.py <path/to/h5>.
    - If given a .h5 it will run one file, if given a directory it will run through all files in the directory. 
- Add <-r> as a flag to run a recursive search through subdirectories. 


"""




# Acceptable standards for bots to pass:
maximum_false_dive_rate = 0.10 # Out of 10 dives there can be 1 false dive
maximum_imu_issues_per_hour = 3
maximum_false_transits_per_hour = 3
maximum_distance_off_desired_dive_hold_depth = 2 # In meters
maximum_time_at_incorrect_dive_hold_depth = 15 # In seconds
maximum_threshold_to_reenter_dive_depth = 1 # In meters


def get_data(file_list):
    
    data_list = pd.DataFrame(columns=["Bot ID", "Start datetime", "End datetime", "IMU issues", "Hours running", "IMU issues per hour", "Proportion of time at cal 0", "Proportion of time at cal 1", "Proportion of time at cal 2", "Proportion of time at cal 3"])

    sd = SortedDict({})
    issues_per_bot = SortedDict({})
    total_runtime = SortedDict({})

    bot_time_at_cal0 = SortedDict({})
    bot_time_at_cal1 = SortedDict({})
    bot_time_at_cal2 = SortedDict({})
    bot_time_at_cal3 = SortedDict({})

    cal_data_length = SortedDict({})

    total_dives = SortedDict({})
    total_false_dives = SortedDict({})

    reaquire_gps_total = SortedDict({})
    reaquire_gps_time = SortedDict({})

    dive_reaquire_gps_total = SortedDict({})
    dive_reaquire_gps_time = SortedDict({})

    bot_false_transits = SortedDict({})

    bot_holds_dive = SortedDict({})

    for filename in file_list:
        with h5py.File(filename, 'r') as file:
            #print(filename)
            groups = file.keys()

            # Groups we're interested in
            task_pattern = re.compile(r'jaiabot::task_packet;.')
            status_pattern = re.compile(r'jaiabot::bot_status;.')

            str_filename = str(filename).split('_')
            instance_fleet_number = str_filename[-2][5:]


            try:
                for group in groups:
                    if task_pattern.search(group):
                        task_packet = file[group]
                    elif status_pattern.search(group):
                        bot_status = file[group]

                # Bot Status Data
                try:
                    status_utime_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/_utime_'], name='status_utime')
                except:
                    continue
                bot_id_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/bot_id'], name='bot_id')
                #fleet = pd.Series(file['goby::configuration/jaiabot.config.MissionManager/fleet_id'], name='fleet')
                mission_state_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/mission_state'], name='mission_state')
                status_scheme = pd.Series(bot_status['jaiabot.protobuf.BotStatus/_scheme_'], name='status_scheme')
                status_calibration_state_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/calibration_status'], name='calibration_status')
                status_depth_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/depth'], name='status_depth')
                
                # desired_depth = pd.Series(file['jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints/helm_course/depth'], name='desired_depth')
                # desired_depth = pd.Series(file['goby::middleware::frontseat::desired_course/goby.middleware.frontseat.protobuf.DesiredCourse/depth'], name='desired_depth')
                try:
                    desired_depth = pd.Series(file['jaiabot::mission_dive/jaiabot.protobuf.DivePowerDescentDebug/goal_depth'], name='desired_depth')
                except:
                    print("Continue")
                    
                # desired_depth.reset_index(drop=True, inplace=True)

                status_utime = status_utime_unfiltered[status_scheme != 1]
                bot_id = bot_id_unfiltered[status_scheme != 1]
                mission_state = mission_state_unfiltered[status_scheme != 1]
                status_calibration_state = status_calibration_state_unfiltered[status_scheme != 1]
                status_depth = status_depth_unfiltered[status_scheme != 1]

                status_utime.reset_index(drop=True, inplace=True)
                bot_id.reset_index(drop=True, inplace=True)
                mission_state.reset_index(drop=True, inplace=True)
                status_calibration_state.reset_index(drop=True, inplace=True)
                status_depth.reset_index(drop=True, inplace=True)

                instance_bot_number = max(bot_id)

                # print("Desired depth length before: ", len(desired_depth))

                desired_depth = desired_depth.reindex(range(len(status_depth)), method='ffill')
                desired_depth.reset_index(drop=True, inplace=True)
                
                # print("Desired depth length after: ", len(desired_depth))
                # print(desired_depth)
                # print("Desired depth drop na", len(desired_depth.dropna()))
                # desired_depth = desired_depth.dropna()
                # desired_depth = desired_depth[desired_depth!=0]
                # print("Status depth length: ", len(status_depth))
                # print(desired_depth)
                # length_diff = abs(len(desired_depth) - len(status_depth))
                # print("Length difference: ", length_diff)
                
                # Amount of IMU Issues that we detected
                imu_issues = 0
                i = 0

                time_at_cal0 = 0
                time_at_cal1 = 0
                time_at_cal2 = 0
                time_at_cal3 = 0

                first_transit_index = np.where(mission_state == 110)[0][0]
                last_stop_index = np.where(mission_state == 142)[-1][-1]

                indices_searched = last_stop_index - first_transit_index
                if(indices_searched <= 0):
                    indices_searched = len(status_calibration_state)
                    first_transit_index = 0
                    last_stop_index = len(status_calibration_state)-1

                i = first_transit_index

                while i < last_stop_index:
                    if(status_calibration_state[i] == 0):
                        time_at_cal0 += 1
                    elif(status_calibration_state[i] == 1):
                        time_at_cal1 += 1
                    elif(status_calibration_state[i] == 2):
                        time_at_cal2 += 1
                    elif(status_calibration_state[i] == 3):
                        time_at_cal3 += 1

                    i += 1

                imu_issue_count = pd.Series([imu_issues])
                imu_issue_count.name = 'IMU Issues'

                # Amount of IMU Issues that we detected
                imu_issues = 0
                i = first_transit_index
                while i < last_stop_index:
                    if mission_state[i] == 160:
                        imu_issues += 1
                        while mission_state[i] == 160:
                            i += 1
                    else:
                        i += 1

                dives = 0
                false_dives = 0
                i = first_transit_index
                while i < last_stop_index:
                    if mission_state[i] == 124:
                        dives += 1
                        max_depth = 0
                        while mission_state[i] == 124:
                            max_depth = max(max_depth, status_depth[i])
                            i += 1
                        if max_depth < 0.5:
                            false_dives += 1
                    else:
                        i += 1

                status_datetime = pd.to_datetime(status_utime, unit='us', origin='unix', utc=True).dt.tz_convert('America/New_York')
                status_datetime.name = 'Date/Time'

                reaquire_gps_states = 0
                reaquire_gps_lengths = pd.Series()
                i = first_transit_index
                while i < last_stop_index:
                    if mission_state[i] == 161:
                        reaquire_gps_states += 1

                        inst_start_time = str(status_datetime[i])[0:-13]
                        inst_start_time = inst_start_time[-8:]

                        while mission_state[i] == 161:
                            i += 1
                        
                        inst_end_time = str(status_datetime[i])[0:-13]
                        inst_end_time = inst_end_time[-8:]

                        # print(inst_start_time)
                        # print(inst_end_time)

                        time_diff = datetime.strptime(inst_end_time, "%H:%M:%S") - datetime.strptime(inst_start_time, "%H:%M:%S")

                        reaquire_gps_lengths[len(reaquire_gps_lengths)-1] = time_diff.total_seconds()

                    else:
                        i += 1

                dive_reaquire_gps_states = 0
                dive_reaquire_gps_lengths = pd.Series()
                i = first_transit_index
                while i < last_stop_index:
                    if mission_state[i] == 128:
                        dive_reaquire_gps_states += 1

                        inst_start_time = str(status_datetime[i])[0:-13]
                        inst_start_time = inst_start_time[-8:]

                        while mission_state[i] == 128:
                            i += 1
                        
                        inst_end_time = str(status_datetime[i])[0:-13]
                        inst_end_time = inst_end_time[-8:]

                        # print(inst_start_time)
                        # print(inst_end_time)

                        time_diff = datetime.strptime(inst_end_time, "%H:%M:%S") - datetime.strptime(inst_start_time, "%H:%M:%S")

                        dive_reaquire_gps_lengths[len(dive_reaquire_gps_lengths)-1] = time_diff.total_seconds()

                    else:
                        i += 1
                
                false_transits = 0
                i = first_transit_index
                while i < last_stop_index:
                    if mission_state[i] == 163:
                        false_transits += 1
                        while mission_state[i] == 163:
                            i += 1
                    else:
                        i += 1

                # i = first_transit_index
                # while i < last_stop_index:
                #     if desired_depth[i] != 0 and not np.isnan(desired_depth[i]):
                #             print("Desired depth: ", desired_depth[i])
                #     i += 1
                
                i = first_transit_index
                holds_dive = 0

                while i < last_stop_index:
                    if mission_state[i] == 125:
                        time_at_incorrect_depth = 0

                        max_depth_achieved = 0

                        reentered_dive_threshold_count = 0
                        while reentered_dive_threshold_count < 2 and mission_state[i] == 125:
                                # print("Pass")
                                max_depth_achieved = max(max_depth_achieved, status_depth[i])

                                if status_depth[i] - desired_depth[i] < maximum_threshold_to_reenter_dive_depth:
                                    reentered_dive_threshold_count += 1
                                i += 1

                        while mission_state[i] == 125:
                            if desired_depth[i] != 0 and not np.isnan(desired_depth[i]):
                                # print("Status depth: ", status_depth[i])
                                # print("Desired depth: ", desired_depth[i])
                                if abs(status_depth[i] - desired_depth[i]) > maximum_distance_off_desired_dive_hold_depth:
                                    time_at_incorrect_depth += 1
                                    if time_at_incorrect_depth > maximum_time_at_incorrect_dive_hold_depth  and max_depth_achieved > desired_depth[i] - maximum_distance_off_desired_dive_hold_depth:
                                        holds_dive += 1
                                        time_at_incorrect_depth = 0
                                        # print("Status depth: ", status_depth[i-15:i])
                                        # print("Desired depth: ", desired_depth[i-15:i])
                                else:
                                    time_at_incorrect_depth = 0
                            i += 1
                    else:
                        i += 1
                                    

                instance_start_time = str(status_datetime[0])[0:-16]
                instance_end_time = str(status_datetime[len(status_datetime)-1])[0:-16]

                run_start_time = instance_start_time[-5:]
                run_end_time = instance_end_time[-5:]

                datetime_start = datetime.strptime(run_start_time, "%H:%M")
                datetime_end = datetime.strptime(run_end_time, "%H:%M")

                time_difference = datetime_end - datetime_start

                hours_running = time_difference.total_seconds() / 3600

                instance_bot_id = "Fleet " + str(instance_fleet_number) + " Bot " + str(instance_bot_number)# + "\nIMU Type: " + str(instance_bot_imu_type)
                
                data_list.loc[len(data_list)] = [instance_bot_id, str(instance_start_time), str(instance_end_time), imu_issues, round(hours_running, 2), round(imu_issues/hours_running, 2), round(time_at_cal0/indices_searched, 2), round(time_at_cal1/indices_searched, 2), round(time_at_cal2/indices_searched, 2), round(time_at_cal3/indices_searched, 2)]

                if(instance_bot_id in sd):
                    bot_time_at_cal0[instance_bot_id] += time_at_cal0
                    bot_time_at_cal1[instance_bot_id] += time_at_cal1
                    bot_time_at_cal2[instance_bot_id] += time_at_cal2
                    bot_time_at_cal3[instance_bot_id] += time_at_cal3
                    cal_data_length[instance_bot_id] += indices_searched
                    issues_per_bot[instance_bot_id] += imu_issues
                    total_runtime[instance_bot_id] += hours_running
                    total_dives[instance_bot_id] += dives
                    total_false_dives[instance_bot_id] += false_dives
                    dive_reaquire_gps_total[instance_bot_id] += dive_reaquire_gps_states
                    reaquire_gps_total[instance_bot_id] += reaquire_gps_states
                    reaquire_gps_time[instance_bot_id] += reaquire_gps_lengths.sum()
                    dive_reaquire_gps_time[instance_bot_id] += dive_reaquire_gps_lengths.sum()
                    bot_false_transits[instance_bot_id] += false_transits
                    bot_holds_dive[instance_bot_id] += holds_dive
                    # print(reaquire_gps_time[instance_bot_id])
                    sd[instance_bot_id] = str(sd[instance_bot_id]) + "\n---------------------\nStart datetime: " + str(instance_start_time) + "\nEnd datetime: " + str(instance_end_time) + "\nProportion of time at cal 0: " + str(round(time_at_cal0/indices_searched, 2)) + "\nProportion of time at cal 1: " + str(round(time_at_cal1/indices_searched, 2)) + "\nProportion of time at cal 2: " + str(round(time_at_cal2/indices_searched, 2)) + "\nProportion of time at cal 3: " + str(round(time_at_cal3/indices_searched, 2)) + "\nIMU Issues: " + str(imu_issues) + "\nIMU Issues per hour: " + str(round(imu_issues/hours_running, 2))
                else: 
                    bot_time_at_cal0[instance_bot_id] = time_at_cal0
                    bot_time_at_cal1[instance_bot_id] = time_at_cal1
                    bot_time_at_cal2[instance_bot_id] = time_at_cal2
                    bot_time_at_cal3[instance_bot_id] = time_at_cal3
                    cal_data_length[instance_bot_id] = indices_searched
                    issues_per_bot[instance_bot_id] = imu_issues
                    total_runtime[instance_bot_id] = hours_running
                    total_dives[instance_bot_id] = dives
                    total_false_dives[instance_bot_id] = false_dives
                    dive_reaquire_gps_total[instance_bot_id] = dive_reaquire_gps_states
                    reaquire_gps_total[instance_bot_id] = reaquire_gps_states
                    reaquire_gps_time[instance_bot_id] = reaquire_gps_lengths.sum()
                    dive_reaquire_gps_time[instance_bot_id] = dive_reaquire_gps_lengths.sum()
                    bot_false_transits[instance_bot_id] = false_transits
                    bot_holds_dive[instance_bot_id] = holds_dive
                    # print("Reaquire gps", reaquire_gps_time[instance_bot_id])
                    sd[instance_bot_id] = "\n---------------------\nStart datetime: " + str(instance_start_time) + "\nEnd datetime: " + str(instance_end_time) + "\nProportion of time at cal 0: " + str(round(time_at_cal0/indices_searched, 2)) + "\nProportion of time at cal 1: " + str(round(time_at_cal1/indices_searched, 2)) + "\nProportion of time at cal 2: " + str(round(time_at_cal2/indices_searched, 2)) + "\nProportion of time at cal 3: " + str(round(time_at_cal3/indices_searched, 2)) + "\nIMU Issues: " + str(imu_issues) + "\nIMU Issues per hour: " + str(round(imu_issues/hours_running, 2))
                

            except IOError as e:
                file.close()
                print(f"Error {e}")
                continue

    bot_df = pd.DataFrame(columns=["Bot ID", "IMU Issues", "Total bot runtime", "IMU Issues per hour", "Percentage of time at calibration level 0", "Percentage of time at calibration level 1", "Percentage of time at calibration level 2", "Percentage of time at calibration level 3"])
    
    bot_data = SortedDict({})

    for key in sd:
        print("\n---------------------\n", key)
        # print(sd[key])
        print("---------------------\nTotal bot runtime: ", round(total_runtime[key], 2), " hours")
        # print("Total time spent at calibration level 0: ", round((bot_time_at_cal0[key] / cal_data_length[key]), 2))
        # print("Total time spent at calibration level 1: ", round((bot_time_at_cal1[key] / cal_data_length[key]), 2))
        # print("Total time spent at calibration level 2: ", round((bot_time_at_cal2[key] / cal_data_length[key]), 2))
        # print("Total time spent at calibration level 3: ", round((bot_time_at_cal3[key] / cal_data_length[key]), 2))
        print("Total IMU Issues: ", issues_per_bot[key])
        print("Total dives: ", total_dives[key])
        print("False dives: ", total_false_dives[key])
        print("Non-dive reaquire GPS states: ", reaquire_gps_total[key])
        reaquire_gps_data = 0
        if reaquire_gps_total[key] != 0:
            reaquire_gps_data = round(reaquire_gps_time[key]/reaquire_gps_total[key], 2)
            print("Non-dive average time to reaquire GPS: ", round(reaquire_gps_time[key]/reaquire_gps_total[key], 2), " seconds")
        dive_reaquire_gps_data = 0
        if dive_reaquire_gps_total[key] != 0:
            dive_reaquire_gps_data = round(dive_reaquire_gps_time[key]/dive_reaquire_gps_total[key], 2)
            print("Average time to reaquire GPS post-dive: ", round(dive_reaquire_gps_time[key]/dive_reaquire_gps_total[key], 2), " seconds")
        print("Number of false transits: ", bot_false_transits[key])



        


        bot_passes_tests = ""
        if total_false_dives[key] / total_dives[key] > maximum_false_dive_rate:
            bot_passes_tests += "\n - Frequent false dives"
        if issues_per_bot[key] / total_runtime[key] > maximum_imu_issues_per_hour:
            bot_passes_tests += "\n - Multiple IMU issues"
        if bot_false_transits[key] / total_runtime[key] > maximum_false_transits_per_hour:
            bot_passes_tests += "\n - Multiple false transits"
        if bot_holds_dive[key] > 0:
            bot_passes_tests += "\n - Inconsistent depth during dive holds"
        
        print("---------------------")
        bot_passes_tests_message = ""
        if bot_passes_tests == "":
            print("Bot passes tests.")
            bot_passes_tests_message = "Bot passes tests."
        else:
            print("Bot fails tests because of:", bot_passes_tests)
            bot_passes_tests_message = "Bot fails tests because of:" + bot_passes_tests

        instance = pd.DataFrame(columns=["Bot ID", "Total bot runtime (hours)", "Total IMU Issues", "Total dives", "False dives", "Non-dive reaquire GPS states", "Non-dive average time to reaquire GPS", "Average time to reaquire GPS post-dive", "Number of false transits", "Does bot pass factory acceptance tests?"])
        instance.loc[0] = [key, str(round(total_runtime[key], 2)), str(issues_per_bot[key]), str(total_dives[key]), str(total_false_dives[key]), str(reaquire_gps_total[key]), str(reaquire_gps_data), str(dive_reaquire_gps_data), str(bot_false_transits[key]), str(bot_passes_tests_message)]
        bot_data[key] = instance

        # print("IMU issues per hour: ", round(issues_per_bot[key]/total_runtime[key], 2))

        bot_data_column = [key, issues_per_bot[key], round(total_runtime[key], 2), round(issues_per_bot[key]/total_runtime[key], 2), round((bot_time_at_cal0[key] / cal_data_length[key]), 2),
                               round((bot_time_at_cal1[key] / cal_data_length[key]), 2), round((bot_time_at_cal2[key] / cal_data_length[key]), 2),
                               round((bot_time_at_cal3[key] / cal_data_length[key]), 2)]
        
        bot_df.loc[len(bot_df)] = bot_data_column


    data_list['Start date'] = data_list['Start datetime'].str[:10]
    data_list = data_list.sort_values(by=['Start date', 'Bot ID'])

    data_list['Start datetime'] = data_list['Start datetime'].str[5:]
    data_list['End datetime'] = data_list['End datetime'].str[5:]

    return bot_data

def get_files(path, recursive):
    if os.path.isdir(path):
        if recursive:
            return list(Path(path).rglob('*.h5'))
        else:
            return list(Path(path).glob('*.h5'))
    elif os.path.isfile(path) and path.endswith('.h5'):
        return [path]
    else:
        print("File or Directory does not exist or File is not an h5. Try again.")

def export_data(bot_data, out_path="..\\..\\..\\..\\test.xlsx"):

    with pd.ExcelWriter(out_path, mode='w') as writer: 

        for key in bot_data:
            bot_data[key].transpose().to_excel(writer, sheet_name=key)

        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            
            for col in worksheet.columns:
                max_length = 0
                column = col[0].column_letter # Get the column name
                for cell in col:
                    try: # Necessary to avoid error on empty cells
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2) * 1.2
                worksheet.column_dimensions[column].width = adjusted_width
            

def main():

    parser = argparse.ArgumentParser(description='Dynamically allow users to parse through a series of datafiles.')
    parser.add_argument("file_path", type=str, help="Path to directory .h5 file.")
    parser.add_argument("-r", "--recursive", action="store_true", help="Recursively find all .h5 files in a directory and all of its subdirectories.")
    args = parser.parse_args()

    file_list = get_files(args.file_path, args.recursive)
    bot_data = get_data(file_list)

    export_data(bot_data)


if __name__ == '__main__':
    main()
