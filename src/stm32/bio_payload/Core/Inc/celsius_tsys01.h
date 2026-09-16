/*
 * celsius_tsys01.h
 *
 *  Blue Robotics Celsius Fast-Response Temperature Sensor (TE TSYS01)
 */

#ifndef INC_CELSIUS_TSYS01_H_
#define INC_CELSIUS_TSYS01_H_

#include "stdint.h"

#include "main.h" // for I2C_HandleTypeDef

// The factory calibration polynomial uses five PROM words (k0..k4)
#define TSYS01_COEFFICIENT_COUNT 5

typedef struct TSYS01
{
    I2C_HandleTypeDef* pi2c;
    uint16_t k[TSYS01_COEFFICIENT_COUNT];
    double temperature;
} sTSYS01;

// External Global Variables
extern sTSYS01 sTemperature;

// Function Declarations
int initTSYS01(I2C_HandleTypeDef* i2cHandle);
int readTSYS01(void);

double getTSYS01Temperature(void);

#endif /* INC_CELSIUS_TSYS01_H_ */
