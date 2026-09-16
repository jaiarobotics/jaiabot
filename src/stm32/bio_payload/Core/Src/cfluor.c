#include "cfluor.h"

CFluor sFluorometer[CFLUOR_INSTANCE_COUNT];

// Each fluorometer is wired to its own analog input on the payload board.
// On Rev 1.1 these are PC2 and PA7; PC1 carries the thermistor.
static float getInputVoltage(int instance)
{
    return (instance == 1) ? adc_voltage6 : adc_voltage2;
}

int readCFluor(int instance)
{
    sFluorometer[instance].concentration_voltage = convert_3_3_to_5_0(getInputVoltage(instance));
    sFluorometer[instance].concentration = (sFluorometer[instance].concentration_voltage - sFluorometer[instance].offset) * sFluorometer[instance].cal_coefficient;

    return 0;
}

float convert_3_3_to_5_0(float voltage)
{
    return voltage * (5.0f / 3.3f);
}

void initCFluor()
{
    for (int instance = 0; instance < CFLUOR_INSTANCE_COUNT; instance++)
    {
        sFluorometer[instance].offset = 0.0f;
        sFluorometer[instance].cal_coefficient = 1.0f;
    }
}

void set_CFluorOffset(int instance, float offset)
{
    sFluorometer[instance].offset = offset;
}

void set_CFluorCalCoefficient(int instance, float cal_coefficient)
{
    sFluorometer[instance].cal_coefficient = cal_coefficient;
}

void set_CFluorSerialNumber(int instance, float serial_number)
{
    sFluorometer[instance].serial_number = serial_number;
}

float getConcentration(int instance)
{
    return sFluorometer[instance].concentration;
}

float getConcentrationVoltage(int instance)
{
    return sFluorometer[instance].concentration_voltage;
}

float getOffset(int instance)
{
    return sFluorometer[instance].offset;
}

float getCalCoefficient(int instance)
{
    return sFluorometer[instance].cal_coefficient;
}

float getSerialNumber(int instance)
{
    return sFluorometer[instance].serial_number;
}
