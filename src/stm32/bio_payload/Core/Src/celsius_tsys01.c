/*
 * celsius_tsys01.c
 *
 *  Blue Robotics Celsius Fast-Response Temperature Sensor (TE TSYS01)
 */

#include "celsius_tsys01.h"

#include <stddef.h>

#include "main.h"

// This code is a port of src/python/tsys01_temperature_sensor/tsys01 (itself a port of
// https://github.com/bluerobotics/tsys01-python) for STM32
// Temperature Sensor: https://bluerobotics.com/store/sensors-cameras/sensors/celsius-sensor-r1/
// Datasheet: https://www.te.com/commerce/DocumentDelivery/DDEController?Action=srchrtrv&DocNm=TSYS01&DocType=Data+Sheet&DocLang=English

// Notes:
// - Every module is individually factory calibrated. The five resulting coefficients are stored in
//    the PROM of each module and are read back once at init to feed the temperature polynomial.

// Global Variables
sTSYS01 sTemperature;

const uint8_t TSYS01_ADDR = 0x77;
const uint8_t TSYS01_RESET = 0x1E;
const uint8_t TSYS01_CONVERT = 0x48;
const uint8_t TSYS01_ADC_READ = 0x00;
// k0..k4 live at 0xAA, 0xA8, 0xA6, 0xA4 and 0xA2, i.e. descending from the highest word
const uint8_t TSYS01_PROM_READ_FIRST = 0xAA;

// The MS5837 driver reads its PROM with HAL_MAX_DELAY, but this sensor is optional on the payload,
// so bound the transactions: an absent Celsius must fail init rather than stall the main loop.
const uint32_t TSYS01_I2C_TIMEOUT_MS = 100;
// Reset time, per the Python driver
const uint32_t TSYS01_RESET_DELAY_MS = 100;
// Max conversion time = 9.04 ms
const uint32_t TSYS01_CONVERSION_DELAY_MS = 10;

// Private Functions
static void calculate_temperature(uint32_t adc);
static void delay_us_nop_tsys01(uint32_t us);

/**
  * @brief  Initialize the temperature sensor
  * @param  Pointer to HAL i2c handle
  * @retval 0 for SUCCESS, 1 for FAILURE
  */
int initTSYS01(I2C_HandleTypeDef* i2cHandle)
{
  uint8_t cmd;
  uint8_t data[2];

  // Assign i2c handle to struct
  sTemperature.pi2c = i2cHandle;
  sTemperature.temperature = 0.0;

  if (sTemperature.pi2c == NULL)
  {
    return 1;
  }

  cmd = TSYS01_RESET;

  // Reset the TSYS01, per datasheet
  if (HAL_I2C_Master_Transmit(sTemperature.pi2c, TSYS01_ADDR << 1, &cmd, 1, TSYS01_I2C_TIMEOUT_MS) != HAL_OK)
  {
    return 1;
  }

  // Wait for reset to complete
  HAL_Delay(TSYS01_RESET_DELAY_MS);

  // Read calibration values, one 16 bit word at a time, walking the PROM downwards so that
  // k[0]..k[4] land in the order calculate_temperature() expects
  for ( uint8_t i = 0 ; i < TSYS01_COEFFICIENT_COUNT ; i++ )
  {
    cmd = TSYS01_PROM_READ_FIRST - (i * 2);

    // Send the register address to read from
    if (HAL_I2C_Master_Transmit(sTemperature.pi2c, TSYS01_ADDR << 1, &cmd, 1, TSYS01_I2C_TIMEOUT_MS) != HAL_OK)
    {
      return 1;
    }

    delay_us_nop_tsys01(10);

    // Read 2 bytes from the sensor
    if (HAL_I2C_Master_Receive(sTemperature.pi2c, TSYS01_ADDR << 1, data, 2, TSYS01_I2C_TIMEOUT_MS) != HAL_OK)
    {
      return 1;
    }

    // Combine the received bytes into a 16-bit value. The sensor clocks the word out MSB first;
    // the Python driver's byte swap only undoes SMBus's little-endian word transfers.
    sTemperature.k[i] = ((uint16_t)data[0] << 8) | data[1];
  }

  return 0;
}

int readTSYS01(void)
{
  uint8_t cmd;
  uint8_t data[3];
  uint32_t adc;

  // Check that pi2c is not NULL (i.e. has the user forgotten to call initTSYS01?)
  if (sTemperature.pi2c == NULL)
  {
    return 1;
  }

  // Request conversion
  cmd = TSYS01_CONVERT;
  if (HAL_I2C_Master_Transmit(sTemperature.pi2c, TSYS01_ADDR << 1, &cmd, 1, TSYS01_I2C_TIMEOUT_MS) != HAL_OK)
  {
    return 1;
  }

  // Delay for conversion time
  HAL_Delay(TSYS01_CONVERSION_DELAY_MS);

  // Request ADC read command
  cmd = TSYS01_ADC_READ;
  if (HAL_I2C_Master_Transmit(sTemperature.pi2c, TSYS01_ADDR << 1, &cmd, 1, TSYS01_I2C_TIMEOUT_MS) != HAL_OK)
  {
    return 1;
  }

  delay_us_nop_tsys01(10);

  // Read 3 bytes from the sensor
  if (HAL_I2C_Master_Receive(sTemperature.pi2c, TSYS01_ADDR << 1, data, 3, TSYS01_I2C_TIMEOUT_MS) != HAL_OK)
  {
    return 1;
  }

  // Combine the received bytes into a 24-bit value
  adc = ((uint32_t)data[0] << 16) | ((uint32_t)data[1] << 8) | data[2];

  calculate_temperature(adc);

  return 0;
}

// Degrees C
double getTSYS01Temperature(void)
{
  return sTemperature.temperature;
}

// Cribbed from datasheet. Kept in double precision: adc16^4 reaches ~1.8e19, which a float
// cannot hold to anywhere near the resolution the leading coefficient needs.
static void calculate_temperature(uint32_t adc)
{
  double adc16 = (double)adc / 256.0;
  double adc16_2 = adc16 * adc16;
  double adc16_3 = adc16_2 * adc16;
  double adc16_4 = adc16_3 * adc16;

  sTemperature.temperature = -2.0  * (double)sTemperature.k[4] * 1e-21 * adc16_4 +
                              4.0  * (double)sTemperature.k[3] * 1e-16 * adc16_3 +
                             -2.0  * (double)sTemperature.k[2] * 1e-11 * adc16_2 +
                              1.0  * (double)sTemperature.k[1] * 1e-6  * adc16   +
                             -1.5  * (double)sTemperature.k[0] * 1e-2;
}

// Rough microsecond delay. Volatile variable to prevent compiler optimizing out in -O3
static void delay_us_nop_tsys01(uint32_t us)
{
    volatile uint32_t iterations = (us * (SystemCoreClock / 1e6));
    while (iterations--)
    {
        __NOP();
    }
}
