from scipy import signal
import numpy as np

import plotly.graph_objs as go

from series import Series


def htmlForSpectrogram(series: Series, fftWindowSeconds: float=40.0):
    # fs = sampling frequency
    fs = len(series.utime) / series.duration().seconds
    print(f'fs = {fs}')
    # N = Number of point in the fft
    N = int(fftWindowSeconds * fs)
    # w = data window
    w = signal.blackman(N)
    freqs, bins, Pxx = signal.spectrogram(np.array(series.y_values), fs, window = w, nfft=N)

    # Plot with plotly
    trace = [go.Heatmap(
        x= bins,
        y= freqs,
        z= 10*np.log10(Pxx),
        colorscale='Jet',
        )]
    layout = go.Layout(
        title = 'Spectrogram with plotly',
        yaxis = dict(title = 'Frequency'), # x-axis label
        xaxis = dict(title = 'Time'), # y-axis label
        )
    fig = go.Figure(data=trace, layout=layout)
    fig.show()
