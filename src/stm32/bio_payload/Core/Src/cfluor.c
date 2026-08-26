#include "cfluor.h"

CFluor sFluorometer;

int readCFluor()
{
    sFluorometer.concentration_voltage = convert_3_3_to_5_0(adc_voltage1);
    sFluorometer.concentration = (sFluorometer.concentration_voltage - sFluorometer.offset) * sFluorometer.cal_coefficient;

    return 0;
}

float convert_3_3_to_5_0(float voltage)
{
    return voltage * (5.0f / 3.3f);
}

void initCFluor()
{
    sFluorometer.offset = 0.0f;
    sFluorometer.cal_coefficient = 1.0f;
}

void set_CFluorOffset(float offset)
{
    sFluorometer.offset = offset;
}

void set_CFluorCalCoefficient(float cal_coefficient)
{
    sFluorometer.cal_coefficient = cal_coefficient;
}

void set_CFluorSerialNumber(float serial_number)
{
    sFluorometer.serial_number = serial_number;
}

float getConcentration()
{
    return sFluorometer.concentration;
}

float getConcentrationVoltage()
{
    return sFluorometer.concentration_voltage;
}

float getOffset()
{
    return sFluorometer.offset;
}

float getCalCoefficient()
{
    return sFluorometer.cal_coefficient;
}

float getSerialNumber()
{
    return sFluorometer.serial_number;
}
