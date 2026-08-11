# Low-Pass Filtering, Inverse Filtering, and SVP Computation

This script takes the consolidated, time-aligned CTD dataset produced by consolidate_ctd.py and applies three sequential processing steps to prepare high-quality Sound Velocity Profiles (SVPs):

1. Low-Pass Filtering (Noise Reduction)
    * A low-pass filter is applied to the raw temperature signal to suppress high-frequency electronic noise while preserving true environmental variability. This smoothing step ensures that subsequent lag-correction is applied to a cleaner signal.
2. Inverse Filtering (Sensor Lag Correction)
    * The smoothed temperature data is then passed through an inverse exponential filter to compensate for the finite thermal response time of the temperature sensor. This correction shifts the signal closer to the “true” in-situ temperature by reducing the temporal lag introduced by the sensor’s physical properties.
3. Sound Velocity Profile Computation
    * Using the lag-corrected temperature, matched conductivity, and corresponding pressure from the aligned dataset, the script computes a depth-resolved sound velocity profile via TEOS-10 algorithms.

The output is a noise-reduced, lag-corrected SVP derived from synchronized CTD measurements, ready for integration into mission analyses and modeling workflows.

### Running the Scripts

1. In order to successfully run this SVP script, you must download the GSW Python Github Toolbox
    - Make an executable 
        ```
        chmod +x create-python-virt-env.sh
        ```
    - Run and download gsw 
        ```
        ./create-python-virt-env.sh
        ```
2. Enter your venv to gain access to gsw
   
    ```
    source venv/bin/activate
    ```
3. Run the svp script
    ```
    python run-svp-pipeline.py \
        --h5 dive_data.h5 \
        --start "2025-07-31 16:22:45" \
        --end   "2025-07-31 16:23:31" \
        --lon -70 --lat 41 \
    ```

    * `--h5` points to the JaiaBot `.h5` log to read
        * dive_data.h5 is just an example 
    * `--start` and `--end` set the extraction window in **EST** (`YYYY-MM-DD HH:MM:SS`). 
    * location `--lon` (deg East; negative = West) and `--lat` (deg North; negative = South) for TEOS-10 conversions. 

### More info on GSW 

Thermodynamic Equation of SeaWater (TEOS‑10) — Software. Available at: https://www.teos-10.org/software.htm.