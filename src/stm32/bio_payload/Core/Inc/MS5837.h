/*
 * MS5837.h
 *
 *  Created on: Mar 4, 2025
 *      Author: ColinVincent
 */

#ifndef INC_MS5837_H_
#define INC_MS5837_H_

#include "stdint.h"

#include "main.h"   // for I2C_HandleTypeDef

// Typedefs and Enums
typedef enum
{
  MS5837_30BA,
  MS5837_02BA
} model_t;

typedef struct MS5837
{
  int fluidDensity;
  I2C_HandleTypeDef* pi2c;
  model_t model;
  int pressure;
  float temp;
} sMS5837;

// External Global Variables
extern sMS5837 sDepth;

// Function Declarations
int readMS5837(void);
int initMS5837(I2C_HandleTypeDef* i2cHandle, model_t version);

void setModel(uint8_t model);
uint8_t getModel(void);

void setFluidDensity(float density);

float getPressure(float conversion);
float getTemperature(void);
float getAltitude(void);
float getDepth(void);

#endif /* INC_MS5837_H_ */
