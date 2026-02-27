################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
C_SRCS += \
../Core/Src/MS5837.c \
../Core/Src/aml.c \
../Core/Src/cfluor.c \
../Core/Src/command.c \
../Core/Src/crc32.c \
../Core/Src/main.c \
../Core/Src/oem_library.c \
../Core/Src/stm32l4xx_hal_msp.c \
../Core/Src/stm32l4xx_it.c \
../Core/Src/syscalls.c \
../Core/Src/sysmem.c \
../Core/Src/system_stm32l4xx.c 

OBJS += \
./Core/Src/MS5837.o \
./Core/Src/aml.o \
./Core/Src/cfluor.o \
./Core/Src/command.o \
./Core/Src/crc32.o \
./Core/Src/main.o \
./Core/Src/oem_library.o \
./Core/Src/stm32l4xx_hal_msp.o \
./Core/Src/stm32l4xx_it.o \
./Core/Src/syscalls.o \
./Core/Src/sysmem.o \
./Core/Src/system_stm32l4xx.o 

C_DEPS += \
./Core/Src/MS5837.d \
./Core/Src/aml.d \
./Core/Src/cfluor.d \
./Core/Src/command.d \
./Core/Src/crc32.d \
./Core/Src/main.d \
./Core/Src/oem_library.d \
./Core/Src/stm32l4xx_hal_msp.d \
./Core/Src/stm32l4xx_it.d \
./Core/Src/syscalls.d \
./Core/Src/sysmem.d \
./Core/Src/system_stm32l4xx.d 


# Each subdirectory must supply rules for building sources it contributes
Core/Src/%.o Core/Src/%.su Core/Src/%.cyclo: ../Core/Src/%.c Core/Src/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m4 -std=gnu11 -g3 -DDEBUG -DUSE_HAL_DRIVER -DSTM32L433xx -c -I../Core/Inc -I../Drivers/STM32L4xx_HAL_Driver/Inc -I../Drivers/STM32L4xx_HAL_Driver/Inc/Legacy -I../Drivers/CMSIS/Device/ST/STM32L4xx/Include -I../Drivers/CMSIS/Include -O0 -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv4-sp-d16 -mfloat-abi=hard -mthumb -o "$@"

clean: clean-Core-2f-Src

clean-Core-2f-Src:
	-$(RM) ./Core/Src/MS5837.cyclo ./Core/Src/MS5837.d ./Core/Src/MS5837.o ./Core/Src/MS5837.su ./Core/Src/aml.cyclo ./Core/Src/aml.d ./Core/Src/aml.o ./Core/Src/aml.su ./Core/Src/cfluor.cyclo ./Core/Src/cfluor.d ./Core/Src/cfluor.o ./Core/Src/cfluor.su ./Core/Src/command.cyclo ./Core/Src/command.d ./Core/Src/command.o ./Core/Src/command.su ./Core/Src/crc32.cyclo ./Core/Src/crc32.d ./Core/Src/crc32.o ./Core/Src/crc32.su ./Core/Src/main.cyclo ./Core/Src/main.d ./Core/Src/main.o ./Core/Src/main.su ./Core/Src/oem_library.cyclo ./Core/Src/oem_library.d ./Core/Src/oem_library.o ./Core/Src/oem_library.su ./Core/Src/stm32l4xx_hal_msp.cyclo ./Core/Src/stm32l4xx_hal_msp.d ./Core/Src/stm32l4xx_hal_msp.o ./Core/Src/stm32l4xx_hal_msp.su ./Core/Src/stm32l4xx_it.cyclo ./Core/Src/stm32l4xx_it.d ./Core/Src/stm32l4xx_it.o ./Core/Src/stm32l4xx_it.su ./Core/Src/syscalls.cyclo ./Core/Src/syscalls.d ./Core/Src/syscalls.o ./Core/Src/syscalls.su ./Core/Src/sysmem.cyclo ./Core/Src/sysmem.d ./Core/Src/sysmem.o ./Core/Src/sysmem.su ./Core/Src/system_stm32l4xx.cyclo ./Core/Src/system_stm32l4xx.d ./Core/Src/system_stm32l4xx.o ./Core/Src/system_stm32l4xx.su

.PHONY: clean-Core-2f-Src

