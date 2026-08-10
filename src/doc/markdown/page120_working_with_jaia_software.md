# Working With Jaia Software

### Table of Contents:
- [Setting Up the Operating System](#setting-up-the-operating-system)
    - [Windows](#windows)
    - [Mac](#mac)
    - [Linux](#linux)
- [Preparing the Workspace](#preparing-the-workspace)
- [Launching the Simulator](#launching-the-simulator)
    - [Stopping the Simulator](#stopping-the-simulator)
    - [Troubleshooting the Simulator](#troubleshooting-the-simulator)
- [Inspecting the Data Logs](#using-the-jdv)
    - [Stopping the JDV](#stopping-the-jdv)
- [Modifying the Code](#modifying-code)
    - [Creating an SSH Key Pair (MacBooks)](#creating-an-ssh-key-macbooks)
- [Deploying the Code](#deploying-code)
    - [Debugging Deployment Issues](#debugging)

If you experience any errors, please visit the troubleshooting section. If that does not resolve the problem, create an issue on GitHub.

# Setting Up the Operating System

## Windows

Install Ubuntu 24.04 using [WSL](https://learn.microsoft.com/en-us/windows/wsl/install).

## Mac

1. Install and open [Multipass](https://canonical.com/multipass/install) and launch Ubuntu 24.04 LTS. 
2. Navigate to ‘All Instances’ and stop `username-hostname`. 
3. Click on `username-hostname` in ‘Name’ column. Switch from ‘Shells’ to ‘Details’ at the top. 
4. Click ‘Configure’ under ‘Resources’. Multipass's default settings will not support the simulator. Change CPUs to 4+, Memory to 4+, Disk to 10+ (at a minimum). 
5. Navigate back to ‘All Instances’ and start `username-hostname`. 
6. 'Open shell' option in Multipass will not work on Mac. Instead, open a Terminal and run the following command to launch Multipass. 
    ```
    multipass shell username-hostname
    ```

## Linux

The JaiaBot project supports Ubuntu 24.04. 

# Preparing the Workspace

1. Clone the JaiaBot repository. Install git if needed. 
    ``` 
    sudo apt install git
    ````
    ```
    git clone https://github.com/jaiarobotics/jaiabot
    ````


2. Run the setup scripts.
    ```
    cd jaiabot/scripts/build
    ```
    ```
    ./setup-tools-build.sh
    ```
    ```
    ./setup-tools-runtime.sh
    ```
3. Move back to the JaiaBot repository. Run the build script.
    ```
    cd ../..
    ```
    ``` 
    ./build.sh
    ```

# Launching the Simulator

## Windows/Linux/Mac

### Using the JCC
1. Launch the JCC web interface.
    ```
    cd src/web
    ```
    ```
    ./run.sh
    ```
    Expected output: 
    ```
    WARNING:root:🏓 Pinging server localhost:40000
    ```
2. Launch the simulator in a separate terminal.
    ```
    cd jaiabot/config/launch/simulation
    ```
3. Set the simulation to run 4 bots at a time warp of 5. 
    ```
    ./generate_all_launch.sh 4 5
    ```
    ```
    ./all.launch
    ```
    Expected output:
    ```
    [all] 08:48:16: All processes running
    ```

4. Open Chrome and go to this address for the JCC:
    
    * Windows/Linux  
        ```
        http://localhost:40001/
        ```
    * Mac - Open Multipass and find your Private IP address associated with the Ubuntu environment.   
        ```
        http://XXX.XXX.XX.X:40001/
        ```

### Stopping the Simulator

In any terminals that are running the web and simulator, type CTRL+C. 


### Troubleshooting the Simulator
* To kill all processes, `cd` into `jaiabot/scripts/dev`, run the kill command, and relaunch the simulator. 
    ```
    ./kill-jaiabot-processes.sh
    ```
* To refresh the build directory, `cd` into `jaiabot` and remove the build directory.
    ```
    rm -rf build
    ``` 
    Then recreate the build directory.
    ```
    ./build.sh
    ```
* Verify you are using Python 3.12. 

<a id="cd-troublshooting"></a>

* If you are getting an error when using our suggested cd path, you are most likely not in the right directory. Your current location will show following your `username-hostname`. For example, you are in the jaiabot scripts directory when you see:

    ```
    ubuntu@username-hostname:~/jaiabot/scripts/build$
    ```

    To see which directories you can move into, use `ls`. To go back a directory, use `cd ..`. You want to move to the directory with your cloned jaia repository. We keep ours in our home directory, so if you want to follow our `cd` commands directly, this would be the best option.

### Troubleshooting with MacBooks

* Purge Multipass in terminal if there's no space on disk or memory.

# Inspecting the Data logs

## Windows/Mac/Linux

### Using the JDV
1. Launch the JDV web interface.
    ```
    cd src/web/jdv
    ```
    ```
    ./run.sh -d ~/jaia-logs/bot_offload
    ```
2. Open Chrome and go to this address for the JDV:
    
    * Windows/Linux  
        ```
        http://localhost:40011/
        ```
    * Mac - Open Multipass and find your Private IP address associated with the Ubuntu environment.   
        ```
        http://XXX.XXX.XX.X:40011/
        ```

    #### Note: You can only run the JDV in one terminal at a time 

### Stopping the JDV
* In the terminal running the JDV, type CTRL+C. 

<br>
<a id="sshkey"></a>

# Modifying Code
If you are modifying code on a Mac, [create an SSH Key](#creating-an-ssh-key-macbooks) first. 

1. Launch the simulator.
2. Modify the code as you see fit.
3. Shut down the simulator and JCC web interface. In any terminals that are running, type CTRL+C. 
4. Build the code.
5. Repeat [launching the simulator](#launching-the-simulator).
6. With the new code tested, it can be [deployed](#deploying-code) to your Jaia System or submitted for review by creating a pull request.

# Creating an SSH Key (MacBooks)

1. Make sure your Multipass instance is running. 
2. Open one terminal and run the following command. 
    ```
    multipass shell username-hostname
    ```
3. Enter your home directory and SSH key.
    ```
    cd ~/.ssh
    ```
    ```
    ls
    ```
    You should see an authorized_keys file. 

4. Enter the authorized_key files.
    ```
    nano authroized_keys
    ```
5. Switch to your local computer on another terminal window. Generate SSH key. 
    ```
    cd .ssh
    ```
    ```
    ssh-keygen
    ```
    You may have to hit enter multiple times to bypass passwords.
    ```
    ls
    ```
    You should see a key that is of the form id_edXXXXX and id_edXXXXX.pub. The following command should generate a key. 
    ```
    cat id_edXXXXX.pub 
    ```

6. Copy and paste the output from the previous step into the nano file in the other terminal window. 
    
    * CTRL+o, enter, CTRL+x -- saves and closes the nano tab. 

7. Switch back to the other terminal (local computer terminal). Set up a config file.
    ```
    nano config
    ```
8. Inside the config file enter this text. Then save and exit:
    ```
    IdentityFile ~/.ssh/id_edXXXXX

    Host jaia
    HostName <IP address from multipass instance> 
    IdentityFile ~/.ssh/id_edXXXXX
    User ubuntu
    ```
9. Enter the environment with your private IP address (XXX.XXX.XX.X).  
    ```
    ssh ubuntu@XXX.XXX.XX.X 
    ```
10. If prompted, enter Yes (Y).
11. Logout of the environment.
    ```
    Exit
    ```
12. Open your IDE (We reccomend VSCode) and download "Remote-SSH" Extension.
13. (Shift, Command+P) -- This opens the search bar. Search "ssh." Select "Remote-SSH: Add New SSH Host..." and hit Enter.
14. Type "ssh ubuntu@XXX.XXX.XX.X" in search bar. Hit Enter.
15. Select /ssh/config. Hit Enter. 
16. There should be a popup in the bottom right corner. Hit "Connect".
17. Your SSH should be set up! You only need to do this once. 

# Deploying Code
1. [Modify the codebase](#modifying-code).
2. Connect to a hub router.
    * Select the SSID JAIA-HUB-WIFI-X from Wi-Fi list (X indicates fleet number).
3. Create Docker image.
    ```
    cd ~/jaiabot/scripts/build
    ```
    ```
    ./docker-build-build-system.sh
    ```
4. Stop the jaiabot services for the system you are deploying to. Note: X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10. 
    ```
    ssh -i /path/to/key jaia@10.23.X.Y
    ```
    ```
    sudo systemctl stop jaiabot
    ```
5. Deploy the simulator.
    ```
    cd ~/jaiabot/scripts/build
    ```
    Deploy to the BOT
    ```
    jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y 
    ```
    Note: X indicates fleet number and Y indicates bot number plus 100. 

    Deploy to the HUB
    ```
    jaiabot_systemd_type=hub ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y 
    ```
    Note: X indicates fleet number and Y indicates hub number plus 10. 

6. Start jaiabot services.
    ```
    ssh -i /path/to/key jaia@10.23.X.Y 
    ```
    Note: X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10
    ```
    sudo systemctl start jaiabot 
    ```
    Note: (takes about 1 min to start)

### Debugging
* Make sure if you are upgrading that you do the entire fleet or stop the services on the systems you are not using.
* This will limit any unexpected issues as mismatched dccl packets cannot be interpreted.
* If you get errors during this upgrade process please contact your Jaia representative.
