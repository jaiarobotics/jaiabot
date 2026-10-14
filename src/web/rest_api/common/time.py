##
## Time convenience functions
##


import time

def utc_now_microseconds():
    return int(time.time() * 1e6)

