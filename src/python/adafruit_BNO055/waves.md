# Wave Height Calculation

This Adafruit python IMU driver incorporates a significant wave height estimation routine, which is described below.  This routine uses the significant wave height as defined using the standard deviation of the water's surface height.

## Data Window

The routine uses a time series data window of vertical acceleration to estimate the significant wave height.  Time series parameters are as follows:

* Window duration is currently hard-coded to 30 seconds, however the time window will correspond to the duration of the bot's drift in a forthcoming update.
* Sample rate ($f_{sample}$) is adjustable, with a default sample rate of 10 Hz.

We refer to this series as $a(t)$.

## Height Series

This acceleration time series is numerically double-integrated to get an estimation of the vertical height series, $h(t)$:

$$h(t) = \int{\int{a(t)dt}}$$

Drift caused by constant velocity components or systematic acceleration errors in the time window is then subtracted. This drift component is a simple least-squares fit to a quadratic function, $h_{drift}(t)$:

$$h_{drift} = at^2 + bt + c$$

$$h_{corrected} = h - h_{drift}$$

## Significant Wave Height

Once this is complete, the significant wave height is calculated using the standard deviation of the height series, as follows:

$$ H_{m_0} = 4\sigma_\eta $$

Where $H_{m_0}$ is the significant wave height, and $\sigma_\eta$ is the standard deviation of the height series, $f(t)$.
