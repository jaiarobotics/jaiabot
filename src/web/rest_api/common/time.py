##
## Time convenience functions
##


import datetime

def utc_now_microseconds():
    return int(datetime.datetime.utcnow().timestamp() * 1e6)
