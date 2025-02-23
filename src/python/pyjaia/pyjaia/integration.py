from typing import *
from pyjaia.series import *
from pyjaia.cubic import *
import numpy as np


y = Series()
y.utime = [0, 2e6, 5e6, 6e6]
y.y_values = [0, 4, 25, 36]

print(resample(y, output_sampling_freq=1).y_values)

def f(x):
    return pow(x, 3) / 3

print([f(y.utime[i] / 1e6) for i in range(len(y.utime))])
