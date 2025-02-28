import csv
from typing import *
from .series import *
from .utils import *
import datetime
import pytz


def datetimeFromUtime(utime: int, tz: tzinfo=pytz.utc):
    return datetime.datetime.fromtimestamp(utime / 1e6, tz)


def write_series_to_csv(series_list: List[Series], filename: str):
    # Get the field names
    fieldnames = ['Time (UDT)', 'Timestamp (micros)']

    for series in series_list:
        fieldnames.append(series.name)

    with open(filename, 'w') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()

        for index in range(len(series_list[0].utime)):
            utime = series_list[0].utime[index]

            row: Dict[str, Any] = {}
            row['Timestamp (micros)'] = utime
            row['Time (UDT)'] = datetimeFromUtime(utime).isoformat('T')
            for series in series_list:
                row[series.name] = series.y_values[index]

            writer.writerow(row)
