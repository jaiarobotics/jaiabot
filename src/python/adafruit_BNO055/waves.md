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

We then pass this spectrum through a band-pass filter that leaves only frequencies between 0.2-2.0 $Hz$.  This corresponds to a period range of 0.5-5.0 $s$.

### Elevation ###

A double-integration is performed to obtain the Fourier transform of the elevation series ($E$).

$$ E(f) = -\frac{A(f)}{(2\pi f)^2}$$

An inverse FFT is then performed, to get the resulting elevation time series, $e(t)$.

### Wave measurement ###

We then step through the samples of $e(t)$, measuring the trough-to-peak heights of each wave.  The mean value of the highest 1/3 of wave heights is calculated.  This is the `significant wave height`, $H_s$.

## Notes ##

### Glitches ###

The `AdaFruit BNO055` IMU produces glitching.  Therefore, I make an attempt to remove as much glitching as possible, while keeping as much valid data as possible.  There are two main types of glitches:  large and small.

During a large glitch, the IMU will return acceleration component(s) with magnitudes exceeding 100 $m/s$.  I filter these out by removing data with these high magnitudes.

The smaller glitches are harder to remove.  When the IMU produces a small glitch, it gives us a value almost exactly `+1.28` $m/s$ from what it should be.  Therefore, for each point of sampled data, I consider if subtracting `1.28` $m/s$ would result in a value that's less than `25%` of the change from the previous data point.  If so, then I subtract `1.28` to correct for the glitch.

### Fade in/out ###

When we take a raw acceleration time series, the starting and ending acceleration values and wave phases will not match, in general.  Because of this offset, when a Fourier transform is performed, we can get significant ringing at certain frequencies when we use the band-pass filter.

To prevent this from happening, we fade the data in and out to get the start and end values of the acceleration to be zero.  We want to make this fade period as short as possible, to avoid impacting the measure wave heights, but we want it at least as long as the period of the prominent waves we are measuring.

We found that a 2 $s$ wave period worked well to reduce the calculated significant wave heights, when tested on a computer-generated signal of known amplitude.  The resulting significant wave heights are typically about +1.5% from the generated monotone frequency.  This compares favorably to the approximately +3.0% from the un-faded time series.
