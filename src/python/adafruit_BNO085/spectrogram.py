from scipy import signal
import numpy as np

import plotly.graph_objs as go

from series import Series
from datetime import *


def htmlForSpectrogram(series: Series, fftWindowSeconds: float=40.0):
    # fs = sampling frequency
    fs = len(series.utime) / series.duration().seconds
    print(f'fs = {fs}')
    # N = Number of point in the fft
    N = int(fftWindowSeconds * fs)
    # w = data window
    w = signal.blackman(N)
    freqs, bins, Pxx = signal.spectrogram(np.array(series.y_values), fs, window = w, nfft=N)

    binTimes = [datetime.fromtimestamp(series.utime[0] / 1e6 + binSeconds) for binSeconds in bins]

    # Plot with plotly
    trace = [go.Heatmap(
        x= binTimes,
        y= freqs,
        z= 10*np.log10(Pxx),
        colorscale='Jet',
        )]
    layout = go.Layout(
        title = f'Spectrogram of {series.name}, FFT window = {fftWindowSeconds:.0f} seconds',
        yaxis = dict(title = 'Frequency (Hz)'), # x-axis label
        xaxis = dict(title = 'Time'), # y-axis label
        )
    fig = go.Figure(data=trace, layout=layout)

    htmlString: str = fig.to_html(full_html=False, include_plotlyjs='cdn', default_width='80%', default_height='60%')

    return htmlString
