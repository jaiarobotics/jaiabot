# STM32 Deploy
To deploy code to the STM32 MCU without using the ST-Link debugger:
1. Copy the `stm32-deploy` directory onto a vehicle
2. Move a `JAIA_BIO-PAYLOAD.elf` file from the STM32CubeIDE inside the `stm32-deploy` directory on the vehicle
3. `cd` into `stm32-deploy` on the vhicle
4. Change the fleet and bot ID in line 8 of `deploy.sh`
5. Run `deploy.sh`

