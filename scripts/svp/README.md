1. In order to successfully run this SVP script, you must download the GSW Pythong Github Toolbox
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
    python run_svp_pipeline.py \
        --h5 dive_data.h5 \
        --start "2025-07-31 16:22:45" \
        --end   "2025-07-31 16:23:31" \
        --inverse-target temp_celsius \
        --tau 9 --fc 0.2 \
        --compute-svp --lon -70 --lat 41 \
        --cond-scale 0.0001 \
        --svp-csv output_svp.csv
    ```

    * `--h5` points to the JaiaBot `.h5` log to read
        * dive_data.h5 is just an example 
    * `--start` and `--end` set the extraction window in **EST** (`YYYY-MM-DD HH:MM:SS`). 
    * If you pass `--inverse-target temp_celsius`, the script lag-corrects that aligned temperature using a first-order inverse filter with time constant `--tau` (seconds) and pre-smoothing cutoff `--fc` (Hz), writing the result to `temp_celsius_inv`. 
        * the parameters `tau` and `fc` should be left as 9 and 0.2 respectively
        * `temp_celsius` refers to the bar30 data
    * `--compute-svp` tells the script to compute the sound-velocity profile (SVP) from the aligned data using location `--lon` (deg East; negative = West) and `--lat` (deg North) for TEOS-10 conversions. 
    * Because GSW expects conductivity in **mS/cm**, `--cond-scale` multiplies your aligned `cond` values to that unit (e.g., 1.0 if already mS/cm; 10.0 if S/m; 0.001 if µS/cm). 
    * `--svp-csv` is the output path for a minimal SVP file containing just `pressure_dbar` and `sound_speed`; 
    * SVP uses `temp_celsius_inv` if present, otherwise `temp_celsius`.
