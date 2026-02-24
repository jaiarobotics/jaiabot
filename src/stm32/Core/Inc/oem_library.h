#ifndef INC_OEM_LIBRARY_H_
#define INC_OEM_LIBRARY_H_

#include "stm32l4xx_hal.h" /* Needed for I2C */
#include "stdint.h"
#include "main.h"

#include <string.h>

/* I2C ADDRESSES */
#define EC_OEM_I2C_ADDR (0x64 << 1)
#define PH_OEM_I2C_ADDR (0x65 << 1)
#define DO_OEM_I2C_ADDR (0x67 << 1)

/* REGISTER ADDRESS ENUMS */

/* Universal register addresses */
#define OEM_REG_DEV_TYPE 0x00
#define OEM_REG_LED 0x05
#define OEM_REG_ACTIVATE 0x06 // Send command 0x01 to activate, 0x00 to hibernate.

/* EC Chip register addresses */
typedef enum
{
    EC_OEM_REG_DEV_TYPE = 0X00,
    EC_OEM_REG_FIRMWARE_VERSION = 0X01,
    EC_OEM_REG_ADDRESS_LOCK = 0X02,
    EC_OEM_REG_ADDRESS = 0X03,
    EC_OEM_REG_INTERRUPT_CTRL = 0X04,
    EC_OEM_REG_LED_CTRL = 0X05,
    EC_OEM_REG_ACTVATE_HIBERNATE = 0X06,
    EC_OEM_REG_NEW_READING_AVAILABLE = 0X07,
    EC_OEM_REG_PROBE_TYPE = 0X08,
    EC_OEM_REG_CAL = 0x0A,       // EC Calibration MSB (4 bytes wide, 0x0A-0x0D)
    EC_OEM_REG_CAL_REQ = 0x0E,   // EC Calibration Request (1 byte wide, 0x0E)
    EC_OEM_REG_CAL_CONF = 0x0F,  // EC Calibration Confirmation (1 byte wide, 0x0F)
    EC_OEM_REG_TEMP_COMP = 0x10, // EC Temperature Compensation (4 bytes wide, 0x10-0x13)
    EC_OEM_REG_TEMP_CONF = 0x14, // EC Temperature Configuration (4 bytes wide, 0x14-0x17)
    EC_OEM_REG_EC = 0x18,        // EC Most Significant Byte (4 bytes wide, 0x18-0x1B)
    EC_OEM_REG_TDS = 0x1C,       // EC TDS (4 bytes wide, 0x1C-0x1F)
    EC_OEM_REG_SALINITY = 0x20,  // EC Salinity (4 bytes wide, 0x20-0x23)
} EC_Registers;

/* pH Chip register addresses */
typedef enum
{
    PH_OEM_REG_DEV_TYPE = 0x00,
    PH_OEM_REG_DEV_VERSION = 0X01,
    PH_OEM_REG_ADDRESS_LOCK = 0X02,
    PH_OEM_REG_ADDRESS = 0X03,
    PH_OEM_REG_INTERRUPT_CTRL = 0X04,
    PH_OEM_REG_LED_CTRL = 0X05,
    PH_OEM_REG_ACTVATE_HIBERNATE = 0X06,
    PH_OEM_REG_NEW_READING_AVAILABLE = 0X07,
    PH_OEM_REG_CAL = 0X08,
    PH_OEM_REG_CAL_REQ = 0X0C,
    PH_OEM_REG_CAL_CONF = 0X0D,
    PH_OEM_REG_TEMP_COMP = 0X0E,
    PH_OEM_REG_TEMP_CONF = 0X12,
    PH_OEM_REG_PH = 0x16,
} PH_Registers;

/* DO Chip register addresses */
typedef enum
{
    DO_OEM_REG_DEV_TYPE = 0x00,
    DO_OEM_REG_DEV_VERSION = 0X01,
    DO_OEM_REG_ADDRESS_LOCK = 0X02,
    DO_OEM_REG_ADDRESS = 0X03,
    DO_OEM_REG_INTERRUPT_CTRL = 0X04,
    DO_OEM_REG_LED_CTRL = 0X05,
    DO_OEM_REG_ACTVATE_HIBERNATE = 0X06,
    DO_OEM_REG_NEW_READING_AVAILABLE = 0X07,
    DO_OEM_REG_CAL = 0X08,
    DO_OEM_REG_CAL_CONF = 0X09,
    DO_OEM_REG_SALINITY_COMP = 0X0A,
    DO_OEM_REG_PRESSURE_COMP = 0X0E,
    DO_OEM_REG_TEMP_COMP = 0X12,
    DO_OEM_REG_SALINITY_CONF = 0X16,
    DO_OEM_REG_PRESSURE_CONF = 0X1A,
    DO_OEM_REG_TEMP_CONF = 0X1E,
    DO_OEM_REG_DO = 0x22,
    DO_OEM_REG_DO_SAT = 0x26,
} DO_Registers;

/* SENSOR STRUCT */
typedef struct
{
    I2C_HandleTypeDef *i2cHandle;
    uint8_t devAddr;
    uint8_t devType;
    double conductivity;
    double total_dissolved_solids;
    double salinity;
    uint8_t calibration_confirmation;
} OEM_EC_CHIP;

typedef struct
{
    I2C_HandleTypeDef *i2cHandle;
    uint8_t devAddr;
    uint8_t devType;
    double ph;
    double temperature;
    float temperature_voltage;
    uint8_t calibration_confirmation;
} OEM_PH_CHIP;

typedef struct
{
    I2C_HandleTypeDef *i2cHandle;
    uint8_t devAddr;
    uint8_t devType;
    double dissolved_oxygen;
    double temperature;
    float temperature_voltage;
    uint8_t calibration_confirmation;
} OEM_DO_CHIP;

extern OEM_EC_CHIP ec;
extern OEM_DO_CHIP dOxy;
extern OEM_PH_CHIP ph;

/* INITIALIZATION */
int initAtlasScientificDO();
int initAtlasScientificPH();
int initAtlasScientificEC();

HAL_StatusTypeDef OEM_Activate(I2C_HandleTypeDef *i2cHandle, uint8_t *devAddr);
// HAL_StatusTypeDef OEM_Hibernate(OEM_CHIP *dev);

// /* COLLECT DATA */
HAL_StatusTypeDef get_ECReading();
HAL_StatusTypeDef get_DOReading();
HAL_StatusTypeDef get_PHReading();
double OEM_ConvertVoltageToTemperature(double voltage);

/* GETTERS */
double getConductivity();
uint8_t getEC_CalibrationConfirmation();
double getTDS();
double getSalinity();
double getDO();
double getPH();
double getDOTemperature();
double getPHTemperature();
double getDOTemperatureVoltage();
double getPHTemperatureVoltage();

// /* CALIBRATION */
HAL_StatusTypeDef calibrateEC(double calibration_value, uint8_t calibration_type);
HAL_StatusTypeDef calibrateDO(uint8_t calibration_type);
HAL_StatusTypeDef calibratePH(double calibration_value, uint8_t calibration_type);
HAL_StatusTypeDef clearCalibration(uint8_t sensor_type);
HAL_StatusTypeDef setECTempCompensation(double compensation_value);
HAL_StatusTypeDef setDOSalinityCompensation(double compensation_value);
HAL_StatusTypeDef setDOPressureCompensation(double compensation_value);
HAL_StatusTypeDef setDOTempCompensation(double compensation_value);
HAL_StatusTypeDef setPHTempCompensation(double compensation_value);


// /* LOW-LEVEL FUNCTIONS */
HAL_StatusTypeDef OEM_ReadRegister(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data);
HAL_StatusTypeDef OEM_ReadRegisters(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data, uint8_t len);
HAL_StatusTypeDef OEM_WriteRegister(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data);
HAL_StatusTypeDef OEM_WriteRegisters(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data, uint8_t len);

#endif
