#ifndef EEPROM_M24128_H
#define EEPROM_M24128_H

#include "main.h"
#include "stm32l4xx_hal.h"
#include <string.h>
#include <stdio.h>

#define eprmMemAddr 0xA0

extern I2C_HandleTypeDef hi2c1;

int eprmTest();
int eprmWriteCommand(I2C_HandleTypeDef *port, uint16_t eprmAddr, uint16_t regAddr, uint8_t *data);
int eprmReadCommand(I2C_HandleTypeDef *port, uint16_t eprmAddr, uint16_t regAddr, uint8_t *data);


#endif