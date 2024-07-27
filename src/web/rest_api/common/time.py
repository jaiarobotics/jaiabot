##
## Time convenience functions
##


import datetime

def utc_now_microseconds():
    return int(datetime.datetime.utcnow().timestamp() * 1e6)

def iso_date_microseconds(iso_date: str):
    """Converts an ISO date string to a Unix microsecond timestamp.

    Args:
        iso_date (str): An ISO date string in the format "YYYY-MM-DD hh:mm:ss[.*]" (UTC timezone assumed)

    Returns:
        int: Unix timestamp in microseconds.
    """
    date_str = str(iso_date).split(".")[0]
    date_format = "%Y-%m-%d %H:%M:%S"
    try:
        return int(datetime.datetime.strptime(date_str, date_format).timestamp() * 1e6)
    except ValueError:
        return None
    