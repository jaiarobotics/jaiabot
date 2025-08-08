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
        --lon -70 --lat 41 \
    ```

    * `--h5` points to the JaiaBot `.h5` log to read
        * dive_data.h5 is just an example 
    * `--start` and `--end` set the extraction window in **EST** (`YYYY-MM-DD HH:MM:SS`). 
    * location `--lon` (deg East; negative = West) and `--lat` (deg North) for TEOS-10 conversions. 
