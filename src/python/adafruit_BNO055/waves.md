# Wave Analysis

This IMU driver includes algorithms to calculate `significant wave height` values from the accelerations measured by the accelerometer.  The algorithms used are summarized below.

## Significant Wave Heights

The `significant wave height` is defined as the average height of the highest one-third of waves.  An elevation time series can be obtained from an acceleration time series by double-integration, because acceleration is the second derivative of position.

Because the IMU includes a `linear acceleration` vector as well as a `gravity` vector, we can project the `linear acceleration` vector along the `gravity` vector to get a value for the vertical acceleration, $a_z$.

After pre-processing this series, we run a fast-Fourier transform (FFT), followed by double integration and inverse FFT.  This results in a time series for the elevation of the bot, $h_z$.

We then run through the time series, measure trough-to-peak wave heights, and calculate the mean of the population of 1/3 highest waves.

The detailed algorithm is as follows.

### Vertical acceleration ($a_z$)

From the IMU, read the `linear acceleration` vector $a$, as well as the `gravity` vector, $g$.  Calculate the vertical component of $a$:

$$a_{z,unfiltered} = \frac{a \cdot g}{\lvert g \rvert}$$

### Pre-process ###

The measured acceleration series is first de-meaned.  Next, some windowing is done to the edges of the time series, as follows.

At the start of a drift, we need to allow the bot to coast to a stop, and eliminate accelerations caused by motor operation and slowing down in the water.

Also, near the end of the drift, we want to cut out the last 5 seconds, for the same reason (sometimes sampling stops just after the motor engages for the next waypoint).

Finally, we use a cosine function to ease in/out the first 5 seconds and last 5 seconds of the data, and make the series continuous and periodic.  This reduces ringing in the Fourier transform.

The ease in/out function is used as follows:

$$a_z = ka_{z,unfiltered}$$
$$k = \frac{cos(\frac{\pi(t-t_0)}{t_{fade}})+1}{2}$$

Where $t_0$ is the end of the fade-in period, or the beginning of the fade-out period, where $t_{fade}$ is 2 seconds.  This step only applies to the 2-second fade period.

### Uniform series ###

The IMU is sampled at a constant rate typically, but for various reasons the actual samples may not be totally uniformly separated in time.  The main reason is that sometimes the IMU has a read error or other glitch where the data needs to be discarded.

Therefore, we process the series into a series with uniformly-spaced samples for the FFT step.  Where there are gaps in the data, we simply duplicate the last value in the series.  Because gaps are rare, this works well for us.

### Filtering ###

We perform an FFT, to transform the time series into an acceleration frequency spectrum, $A$.

We then pass this spectrum through a band-pass filter that leaves only wave periods between 0.5 and 15 $seconds$.  The edges of the filter function are a $cos^2$ attenuation function:

$$k=[\frac{cos(\frac{\pi(f_{lim} - f)}{w}) + 1}{2}]^2$$

where $f_{lim}$ is the frequency of the band edge, and $w$ is the window width.

### Elevation ###

A double-integration is performed to obtain the Fourier transform of the elevation series ($E$).

$$ E(f) = -\frac{A(f)}{(2\pi f)^2}$$

An inverse FFT is then performed, to get the resulting elevation time series, $e(t)$.

### Wave measurement ###

We then step through the samples of $e(t)$, measuring the trough-to-peak heights of each wave.  The mean value of the highest 1/3 of wave heights is calculated.  This is the `significant wave height`, $H_s$.

## Notes ##

### Glitches ###

The `AdaFruit BNO055` IMU produces glitching.  Therefore, I make an attempt to remove as much glitching as possible, while keeping as much valid data as possible.  This is the algorithm to remove glitchy IMU data from the time series before processing.

#### First pass ####

1. Discard reading if the magnitude of the gravity vector ($g$) is outside of the range $[8,50]ms^{-2}$
2. Discard reading if $|g_q|<0.02m^{-2}$, where $q$ is the $x$, $y$, or $z$ component
3. Discard reading if $|a|=0$ or $|a|>50m^{-2}$, where $a$ is the linear acceleration vector
   
#### Second pass ####

1. If $|a_i-a_{mean}|<0.2m^{-2}$, where $a_{mean}=\frac{a_{i-1}+a_{i+1}}{2}$, keep the data point with index $i$ unchanged
2. If $|a_i-a_{extrap}|<0.64m^{-2}$, where $a_{extrap}=a_{i-1}+(t_i-t_{i-1})\frac{a_{i-1}-a_{i-2}}{t_{i-1}-t_{i-2}}$, keep the data point with index $i$ unchanged

#### Third pass (if data not kept unchanged from second pass)

For each of $a_{correction}\in[-1.28, 1.28]$, calculate $a_{corrected}=a_i+a_{correction}$

1. If $|a_{corrected}-a_{mean}|<0.2ms^{-2}$, correct $a_i$ to $a_{corrected}$
2. If $|a_{corrected}-a_{i-1}|<0.2ms^{-2}$, correct $a_i$ to $a_{corrected}$


### Fade in/out ###

When we take a raw acceleration time series, the starting and ending acceleration values and wave phases will not match, in general.  Because of this offset, when a Fourier transform is performed, we can get significant ringing at certain frequencies when we use the band-pass filter.

To prevent this from happening, we fade the data in and out to get the start and end values of the acceleration to be zero.  We want to make this fade period as short as possible, to avoid impacting the measure wave heights, but we want it at least as long as the period of the prominent waves we are measuring.

We found that a 2 $s$ wave period worked well to reduce the calculated significant wave heights, when tested on a computer-generated signal of known amplitude.  The resulting significant wave heights are typically about +1.5% from the generated monotone frequency.  This compares favorably to the approximately +3.0% from the un-faded time series.
