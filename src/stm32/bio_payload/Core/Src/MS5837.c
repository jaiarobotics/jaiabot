/*
 * MS5837.c
 *
 *  Created on: Mar 4, 2025
 *      Author: ColinVincent
 */

#include "MS5837.h"

#include <stdbool.h>

#include "main.h"
#include "math.h"

// This code is a port of https://github.com/bluerobotics/BlueRobotics_MS5837_Library for STM32
// Pressure Sensor: https://bluerobotics.com/store/sensors-cameras/sensors/bar30-sensor-r1/
// Datasheet: https://www.te.com/commerce/DocumentDelivery/DDEController?Action=showdoc&DocId=Data+Sheet%7FMS5837-30BA%7FB1%7Fpdf%7FEnglish%7FENG_DS_MS5837-30BA_B1.pdf%7FCAT-BLPS0017

// Notes:
// - Every module is individually factory calibrated at two temperatures and two pressures. As a result, 6 coefficients
//    necessary to compensate for process variations and temperature variations are calculated and stored in the 112-
//    bit PROM of each module

// Global Variables
sMS5837 sDepth;

const uint8_t MS5837_UNRECOGNISED = 255;
const uint8_t MS5837_ADDR = 0x76;
const uint8_t MS5837_RESET = 0x1E;
const uint8_t MS5837_ADC_READ = 0x00;
const uint8_t MS5837_PROM_READ = 0xA0;
const uint8_t MS5837_CONVERT_D1_8192 = 0x4A;
const uint8_t MS5837_CONVERT_D2_8192 = 0x5A;

const float Pa = 100.0f;
const float bar = 0.001f;
const float mbar = 1.0f;

// Private variables
uint16_t C[8];
uint32_t D1_pres, D2_temp;
int32_t TEMP;
int32_t P;
uint8_t _model;
float fluidDensity;

// Private Functions
void calculate();
uint8_t crc4(uint16_t n_prom[]);
void delay_us_nop(uint32_t us);

/**
  * @brief  Initialize the depth sensor
  * @param  Pointer to HAL i2c handle
  * @retval 0 for SUCCESS, 1 for FAILURE
  */
int initMS5837(I2C_HandleTypeDef* i2cHandle, model_t version)
{
  uint8_t cmd;
  uint8_t data[2];

  sDepth.fluidDensity = 1029;

  // Assign i2c handle to struct
  sDepth.pi2c = i2cHandle;

  cmd = MS5837_RESET;

  // Reset the MS5837, per datasheet
  HAL_I2C_Master_Transmit(sDepth.pi2c, MS5837_ADDR << 1, &cmd, 1, HAL_MAX_DELAY);

  // Wait for reset to complete
  HAL_Delay(10);

  // Read calibration values and CRC
  for ( uint8_t i = 0 ; i < 7 ; i++ )
  {
      uint8_t cmd = MS5837_PROM_READ + i * 2;

      // Send the register address to read from
      HAL_I2C_Master_Transmit(sDepth.pi2c, MS5837_ADDR << 1, &cmd, 1, HAL_MAX_DELAY);

      delay_us_nop(10);

      // Read 2 bytes from the sensor
      HAL_I2C_Master_Receive(sDepth.pi2c, MS5837_ADDR << 1, data, 2, HAL_MAX_DELAY);

      // Combine the received bytes into a 16-bit value
      C[i] = (data[0] << 8) | data[1];
  }

  // Verify that data is correct with CRC
  uint8_t crcRead = C[0] >> 12;
  uint8_t crcCalculated = crc4(C);

  if ( crcCalculated != crcRead )
  {
    return 1; // CRC fail
  }

  // Cannot use PROM word to identify between models anymore
  setModel(version);

  // The sensor has passed the CRC check, so we should return true even if
  // the sensor version is unrecognised.
  // (The MS5637 has the same address as the MS5837 and will also pass the CRC check)
  // (but will hopefully be unrecognised.)
  return 0;
}

void setModel(uint8_t model)
{
  sDepth.model = model;
}

uint8_t getModel(void)
{
  return (sDepth.model);
}

void setFluidDensity(float density)
{
  sDepth.fluidDensity = density;
}

float getPressure(float conversion)
{
  if ( sDepth.model == MS5837_02BA )
  {
    return P*conversion/100.0f;
  }
  else
  {
    return P*conversion/10.0f;
  }
}

float getTemperature(void)
{
  return sDepth.temp/100.0f;
}

// The pressure sensor measures absolute pressure, so it will measure the atmospheric pressure + water pressure
// We subtract the atmospheric pressure to calculate the depth with only the water pressure
// The average atmospheric pressure of 101300 pascal is used for the calcuation, but atmospheric pressure varies
// If the atmospheric pressure is not 101300 at the time of reading, the depth reported will be offset
// In order to calculate the correct depth, the actual atmospheric pressure should be measured once in air, and
// that value should subtracted for subsequent depth calculations.
float getDepth(void)
{
  return (getPressure(Pa) - 101300) / (sDepth.fluidDensity * 9.80665);
}

// Barometric formula for altitude estimation
float getAltitude(void)
{
  return (1 - pow((getPressure(1.0f)/1013.25), 0.190284)) * 145366.45 * 0.3048;
}

int readMS5837(void)
{
  uint8_t cmd;
  uint8_t data[3];

  // Check that _i2cPort is not NULL (i.e. has the user forgoten to call .init or .begin?)
  if (sDepth.pi2c == NULL)
  {
    return 1;
  }

  // Request D1 conversion
  cmd = MS5837_CONVERT_D1_8192;
  HAL_I2C_Master_Transmit(sDepth.pi2c, MS5837_ADDR << 1, &cmd, 1, HAL_MAX_DELAY);

  // Delay for conversion time (20ms)
  HAL_Delay(20);

  // Request ADC read command
  cmd = MS5837_ADC_READ;
  HAL_I2C_Master_Transmit(sDepth.pi2c, MS5837_ADDR << 1, &cmd, 1, HAL_MAX_DELAY);

  delay_us_nop(10);

  // Read 3 bytes from the sensor
  HAL_I2C_Master_Receive(sDepth.pi2c, MS5837_ADDR << 1, data, 3, HAL_MAX_DELAY);

  delay_us_nop(10);

  // Combine the received bytes into a 24-bit value
  D1_pres = ((uint32_t)data[0] << 16) | ((uint32_t)data[1] << 8) | data[2];

  // Request D2 conversion
  cmd = MS5837_CONVERT_D2_8192;
  HAL_I2C_Master_Transmit(sDepth.pi2c, MS5837_ADDR << 1, &cmd, 1, HAL_MAX_DELAY);

  // Delay for conversion time (20ms)
  HAL_Delay(20);

  // Request ADC read command
  cmd = MS5837_ADC_READ;
  HAL_I2C_Master_Transmit(sDepth.pi2c, MS5837_ADDR << 1, &cmd, 1, HAL_MAX_DELAY);

  delay_us_nop(10);

  // Read 3 bytes from the sensor
  HAL_I2C_Master_Receive(sDepth.pi2c, MS5837_ADDR << 1, data, 3, HAL_MAX_DELAY);

  // Combine the received bytes into a 24-bit value
  D2_temp = ((uint32_t)data[0] << 16) | ((uint32_t)data[1] << 8) | data[2];

  calculate();

  return 0;
}

void calculate() {

  // Given C1-C6 and D1, D2, calculated TEMP and P
  // Do conversion first and then second order temp compensation

  int32_t dT = 0;
  int64_t SENS = 0;
  int64_t OFF = 0;

  int32_t SENSi = 0;
  int32_t OFFi = 0;
  int32_t Ti = 0;

  int64_t OFF2 = 0;
  int64_t SENS2 = 0;

  // Terms called
  dT = D2_temp - ((uint32_t) (C[5]) * 256l);

  if ( sDepth.model == MS5837_02BA )
  {
    SENS = (int64_t)(C[1])*65536l+((int64_t)(C[3])*dT)/128l;
    OFF = (int64_t)(C[2])*131072l+((int64_t)(C[4])*dT)/64l;
    P = (D1_pres*SENS/(2097152l)-OFF)/(32768l);
  }
  else
  {
    SENS = (int64_t)(C[1])*32768l+((int64_t)(C[3])*dT)/256l;
    OFF = (int64_t)(C[2])*65536l+((int64_t)(C[4])*dT)/128l;
    P = (D1_pres*SENS/(2097152l)-OFF)/(8192l);
  }

  // Temp conversion
  TEMP = 2000l+(int64_t)(dT)*C[6]/8388608LL;

  // Second order compensation
  if ( sDepth.model == MS5837_02BA )
  {
    if((TEMP/100)<20)
    {
      // Low temp
      Ti = (11*(int64_t)(dT)*(int64_t)(dT))/(34359738368LL);
      OFFi = (31*(TEMP-2000)*(TEMP-2000))/8;
      SENSi = (63*(TEMP-2000)*(TEMP-2000))/32;
    }
  }
  else
  {
    if((TEMP/100)<20)
    {
      // Low temp
      Ti = (3 * (int64_t) (dT) * (int64_t) (dT)) / (8589934592LL);
      OFFi = (3 * (TEMP-2000) * (TEMP-2000)) / 2;
      SENSi = (5 * (TEMP-2000) * (TEMP-2000)) / 8;

      if ((TEMP/100)<-15)
      {
        // Very low temp
        OFFi = OFFi + 7 * (TEMP+1500l) * (TEMP+1500l);
        SENSi = SENSi + 4 * (TEMP+1500l) * (TEMP+1500l);
      }
    }
    else if ((TEMP/100)>=20)
    {
      // High temp
      Ti = 2*(dT*dT)/(137438953472LL);
      OFFi = (1*(TEMP-2000)*(TEMP-2000))/16;
      SENSi = 0;
    }
  }

  // Calculate pressure and temp second order
  OFF2 = OFF - OFFi;
  SENS2 = SENS - SENSi;
  sDepth.temp = TEMP - Ti;

  if ( sDepth.model == MS5837_02BA )
  {
    sDepth.pressure = ((D1_pres * SENS2) / 2097152l - OFF2) / 32768l;
  }
  else
  {
      sDepth.pressure = ((D1_pres * SENS2) / 2097152l - OFF2) / 8192l;
  }
}

// See MS5837 datasheet C Code Example
uint8_t crc4(uint16_t n_prom[])
{
  uint16_t n_rem = 0;

  n_prom[0] = ((n_prom[0]) & 0x0FFF);
  n_prom[7] = 0;

  for ( uint8_t i = 0 ; i < 16; i++ )
  {
    if ( i%2 == 1 )
    {
      n_rem ^= (uint16_t)((n_prom[i>>1]) & 0x00FF);
    }
    else
    {
      n_rem ^= (uint16_t)(n_prom[i>>1] >> 8);
    }
    for ( uint8_t n_bit = 8 ; n_bit > 0 ; n_bit-- )
    {
      if ( n_rem & 0x8000 )
      {
        n_rem = (n_rem << 1) ^ 0x3000;
      }
      else
      {
        n_rem = (n_rem << 1);
      }
    }
  }

  n_rem = ((n_rem >> 12) & 0x000F);

  return n_rem ^ 0x00;
}

// Rough microsecond delay. Volatile variable to prevent compiler optimizing out in -O3
void delay_us_nop(uint32_t us)
{
    volatile uint32_t iterations = (us * (SystemCoreClock / 1e6));
    while (iterations--)
    {
        __NOP();
    }
}
