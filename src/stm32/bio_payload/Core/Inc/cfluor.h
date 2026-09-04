#ifndef INC_CFluor_H_
#define INC_CFluor_H_

#include "main.h"

// Number of fluorometers the payload board can carry
#define CFLUOR_INSTANCE_COUNT 2

typedef struct CFluor
{
    I2C_HandleTypeDef* pi2c;
    float offset;
    float cal_coefficient;
    float concentration;
    float concentration_voltage;
    float serial_number;
} CFluor;

extern CFluor sFluorometer[CFLUOR_INSTANCE_COUNT];

int readCFluor(int instance);
void initCFluor(void);
void set_CFluorOffset(int instance, float offset);
void set_CFluorCalCoefficient(int instance, float cal_coefficient);
void set_CFluorSerialNumber(int instance, float serial_number);
float getConcentration(int instance);
float convert_3_3_to_5_0(float voltage);
float getConcentrationVoltage(int instance);
float getOffset(int instance);
float getCalCoefficient(int instance);
float getSerialNumber(int instance);

#endif /* INC_CFluor_H_ */
