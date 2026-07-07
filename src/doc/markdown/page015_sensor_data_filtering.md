# Sensor Data Filtering (Hampel Filter)

Sensor data occasionally produces spikes that do not reflect the real environment. 
The **Hampel filter** flags these outliers live during a mission. 

The implementation can be applied to any sensor data (salinity, 
temperature, pH, dissolved oxygen, etc.):

- Header: `src/lib/utils/hampel_filter.h`
- Tests: `src/test/utils/test.cpp`

The current implementation only *reports* whether a reading is an
outlier and never alters the raw value. Wiring into individual sensors is handled 
separately.

## Algorithm

The filter holds onto a sliding window of the most recent `window_size` raw readings.
The window only uses past and current samples, so there is no waiting on future 
samples. 

Once the window is established, the filter:

1. Computes the **median** of the window.
2. Computes the **Median Absolute Deviation**:
   `MAD = median(|x_i − median|)`.
3. Scales it: `scaled_mad = 1.4826 × MAD`. The `1.4826` constant converts the MAD 
   into an approximation of the standard deviation for normally distributed data.
4. Flags `x` as an outlier when `|x − median| > num_mads × scaled_mad`.

The median and MAD are used instead of the mean and standard deviation because
they are robust. A single large spike barely moves them, so the spike can't
unfoundedly shift the statistics used to judge it.

### Configuration

- `window_size` (default `7`): the number of recent readings used for the estimate.
  Larger windows are more resistant to noise but slower to adapt to real new data 
  trends. 
- `num_mads` (default `3.0`): outlier threshold represented as a multiple of the 
  scaled MAD. Lower means a stricter threshold that triggers more; higher means
  a looser threshold that triggers less. 

### Behavior notes

- **All raw readings enter the window**, including flagged outliers. Using a 
  median-based filter keeps this accurate, allowing the filter to adapt to real
  sustained data shifts once enough new samples accumulate. Without this, a
  real change would be rejected repeatedly.
- **Initial wait time:** no value is flagged until the window is full (the first
  `window_size − 1` readings).
- **Edge case:** if every value in the window is identical, `scaled_mad` is 0.
  A genuine data shift looks the same as an outlier, so the value is accepted.
