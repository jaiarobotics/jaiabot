#include "oem_library.h"

/* INITIALIZATION */
int initAtlasScientificEC()
{
  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_12, GPIO_PIN_SET);

  HAL_Delay(20);
  ec.devAddr = EC_OEM_I2C_ADDR;
  ec.devType = OEM_ReadRegister(ec.i2cHandle, ec.devAddr, OEM_REG_DEV_TYPE, &ec.devType);

  HAL_Delay(20);
  HAL_StatusTypeDef status = OEM_Activate(ec.i2cHandle, ec.devAddr);

  if (status != HAL_OK)
  {
    Error_Handler();
  }

  return 0;
}

int initAtlasScientificDO()
{
  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_2, GPIO_PIN_SET);

  HAL_Delay(20);
  dOxy.devAddr = DO_OEM_I2C_ADDR;
  dOxy.devType = OEM_ReadRegister(dOxy.i2cHandle, dOxy.devAddr, OEM_REG_DEV_TYPE, &dOxy.devType);

  HAL_Delay(20);
  HAL_StatusTypeDef status = OEM_Activate(dOxy.i2cHandle, dOxy.devAddr);

  if (status != HAL_OK)
  {
    Error_Handler();
  }

  return 0;
}

int initAtlasScientificPH()
{
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);

  HAL_Delay(20);
  ph.devAddr = PH_OEM_I2C_ADDR;
  ph.devType = OEM_ReadRegister(ph.i2cHandle, ph.devAddr, OEM_REG_DEV_TYPE, &ph.devType);

  HAL_Delay(20);
  HAL_StatusTypeDef status = OEM_Activate(ph.i2cHandle, ph.devAddr);

  if (status != HAL_OK)
  {
    Error_Handler();
  }

  return 0;
}

HAL_StatusTypeDef OEM_Activate(I2C_HandleTypeDef *i2cHandle, uint8_t *devAddr)
{
  uint8_t activate_command = 0x01;
  return OEM_WriteRegister(i2cHandle, devAddr, OEM_REG_ACTIVATE, &activate_command);
}

HAL_StatusTypeDef OEM_Hibernate(I2C_HandleTypeDef *i2cHandle, uint8_t *devAddr)
{
  uint8_t hibernate_command = 0x00;
  return OEM_WriteRegister(i2cHandle, devAddr, OEM_REG_ACTIVATE, &hibernate_command);
}

/* COLLECT DATA */
HAL_StatusTypeDef get_ECReading()
{
  uint8_t regData[4];
  float divFactor = 100.0f;
  HAL_StatusTypeDef status = HAL_OK;

  // Electrical Conductivity
  status = OEM_ReadRegisters(ec.i2cHandle, ec.devAddr, EC_OEM_REG_EC, &regData[0], 4);
  uint32_t regReading = (regData[0] << 24) | (regData[1] << 16) | (regData[2] << 8) | regData[3];
  ec.conductivity = (float)regReading / divFactor;

  // TDS
  status = OEM_ReadRegisters(ec.i2cHandle, ec.devAddr, EC_OEM_REG_TDS, &regData[0], 4);
  regReading = (regData[0] << 24) | (regData[1] << 16) | (regData[2] << 8) | regData[3];
  ec.total_dissolved_solids = (float)regReading / divFactor;

  // Salinity
  status = OEM_ReadRegisters(ec.i2cHandle, ec.devAddr, EC_OEM_REG_SALINITY, &regData[0], 4);
  regReading = (regData[0] << 24) | (regData[1] << 16) | (regData[2] << 8) | regData[3];
  ec.salinity = (float)regReading / divFactor;

  // Calibration Confirmation
  status = OEM_ReadRegister(ec.i2cHandle, ec.devAddr, EC_OEM_REG_CAL_CONF, &ec.calibration_confirmation); 

  return status;
}

HAL_StatusTypeDef get_DOReading()
{
  uint8_t regData[4];
  float divFactor = 100.0f;
  HAL_StatusTypeDef status = HAL_OK;

  // Dissovled Oxygen
  status = OEM_ReadRegisters(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_DO, &regData[0], 4);
  uint32_t regReading = (regData[0] << 24) | (regData[1] << 16) | (regData[2] << 8) | regData[3];
  dOxy.dissolved_oxygen = (float)regReading / divFactor;

  // Temperature
  dOxy.temperature = OEM_ConvertVoltageToTemperature(adc_voltage5);
  dOxy.temperature_voltage = adc_voltage5;
  
  return status;
}

HAL_StatusTypeDef get_PHReading()
{
  uint8_t regData[4];
  float divFactor = 1000.0f;
  HAL_StatusTypeDef status = HAL_OK;
 
  // pH
  status = OEM_ReadRegisters(ph.i2cHandle, ph.devAddr, PH_OEM_REG_PH, &regData[0], 4);
  uint32_t regReading = (regData[0] << 24) | (regData[1] << 16) | (regData[2] << 8) | regData[3];
  ph.ph = (float)regReading / divFactor;

  // Temperature
  ph.temperature = OEM_ConvertVoltageToTemperature(adc_voltage4);
  ph.temperature_voltage = adc_voltage4;

  return status;
}

double OEM_ConvertVoltageToTemperature(double voltage)
{
    double Rt = 10000 / ((3.3 / voltage) - 1);
    double temp = -(sqrt(-0.00232 * Rt + 17.59246) - 3.908) / 0.00116;

    return temp;
}

/* GETTERS*/
double getConductivity() { return ec.conductivity; }
double getTDS() { return ec.total_dissolved_solids; }
double getSalinity() { return ec.salinity; }
double getDO() { return dOxy.dissolved_oxygen; }
double getDOTemperature() { return dOxy.temperature; }
double getDOTemperatureVoltage() { return dOxy.temperature_voltage; }
double getPH() { return ph.ph; }
double getPHTemperature() { return ph.temperature; }
double getPHTemperatureVoltage() { return ph.temperature_voltage; }
uint8_t getEC_CalibrationConfirmation() { return ec.calibration_confirmation; }

/* 
 * CALIBRATION DATA
 */
HAL_StatusTypeDef calibrateEC(double calibration_value, uint8_t calibration_type) {
  HAL_StatusTypeDef status;

  // Convert calibearion value from double to uint32_t (hex)
  uint32_t calibration_value_hex = (uint32_t)calibration_value;

  // Reverse the byte order of the calibration value
  uint8_t calibration_value_bytes[4];
  calibration_value_bytes[0] = (calibration_value_hex >> 24) & 0xFF;
  calibration_value_bytes[1] = (calibration_value_hex >> 16) & 0xFF;
  calibration_value_bytes[2] = (calibration_value_hex >> 8) & 0xFF;
  calibration_value_bytes[3] = calibration_value_hex & 0xFF;

  status = OEM_WriteRegisters(ec.i2cHandle, ec.devAddr, EC_OEM_REG_CAL, calibration_value_bytes, 4);
  if (status != HAL_OK) {
    return status;
  }

  status = OEM_WriteRegister(ec.i2cHandle, ec.devAddr, EC_OEM_REG_CAL_REQ, &calibration_type);
  if (status != HAL_OK) {
    return status;
  }

  // Delay to allow calibration confirmation register to be updated
  HAL_Delay(1000);

  status = OEM_ReadRegister(ec.i2cHandle, ec.devAddr, EC_OEM_REG_CAL_CONF, &ec.calibration_confirmation);
  if (status != HAL_OK) {
    return status;
  }

  return status;
}

HAL_StatusTypeDef calibrateDO(uint8_t calibration_type) {
  HAL_StatusTypeDef status;

  status = OEM_WriteRegister(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_CAL, &calibration_type);
  if (status != HAL_OK) {
    return status;
  }

  // Delay to allow calibration confirmation register to be updated
  HAL_Delay(1000);

  status = OEM_ReadRegister(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_CAL_CONF, &dOxy.calibration_confirmation);
  if (status != HAL_OK) {
    return status;
  }

  return status;
}

HAL_StatusTypeDef calibratePH(double calibration_value, uint8_t calibration_type) {
  HAL_StatusTypeDef status;

  // Convert calibration value from double to uint32_t (hex)
  uint32_t calibration_value_hex = (uint32_t)calibration_value;

  // Reverse the byte order of the calibration value
  uint8_t calibration_value_bytes[4];
  calibration_value_bytes[0] = (calibration_value_hex >> 24) & 0xFF;
  calibration_value_bytes[1] = (calibration_value_hex >> 16) & 0xFF;
  calibration_value_bytes[2] = (calibration_value_hex >> 8) & 0xFF;
  calibration_value_bytes[3] = calibration_value_hex & 0xFF;

  status = OEM_WriteRegisters(ph.i2cHandle, ph.devAddr, PH_OEM_REG_CAL, calibration_value_bytes, 4);
  if (status != HAL_OK) {
    return status;
  }

  status = OEM_WriteRegister(ph.i2cHandle, ph.devAddr, PH_OEM_REG_CAL_REQ, &calibration_type);
  if (status != HAL_OK) {
    return status;
  }

  // Delay to allow calibration confirmation register to be updated
  HAL_Delay(1000);

  status = OEM_ReadRegister(ph.i2cHandle, ph.devAddr, PH_OEM_REG_CAL_CONF, &ph.calibration_confirmation);
  if (status != HAL_OK) {
    return status;
  }

  return status;
}

HAL_StatusTypeDef clearCalibration(uint8_t sensor_type) {
  HAL_StatusTypeDef status;
  uint8_t clear_calibration_command = 0x01;

  switch (sensor_type) {
    case jaiabot_sensor_protobuf_Sensor_ATLAS_SCIENTIFIC__OEM_EC:
      status = OEM_WriteRegister(ec.i2cHandle, ec.devAddr, EC_OEM_REG_CAL_REQ, &clear_calibration_command);
      break;
    case jaiabot_sensor_protobuf_Sensor_ATLAS_SCIENTIFIC__OEM_DO:
      status = OEM_WriteRegister(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_CAL, &clear_calibration_command);
      break;
    case jaiabot_sensor_protobuf_Sensor_ATLAS_SCIENTIFIC__OEM_PH:
      status = OEM_WriteRegister(ph.i2cHandle, ph.devAddr, PH_OEM_REG_CAL_REQ, &clear_calibration_command);
      break;
    default:
      return HAL_ERROR;
  }
  
  return status;
}

HAL_StatusTypeDef setECTempCompensation(double compensation_value) {
  // Convert compensation value from double to uint32_t (hex)
  uint32_t compensation_value_hex = (uint32_t)compensation_value;

  // Reverse the byte order of the compensation value
  uint8_t compensation_value_bytes[4];
  compensation_value_bytes[0] = (compensation_value_hex >> 24) & 0xFF;
  compensation_value_bytes[1] = (compensation_value_hex >> 16) & 0xFF;
  compensation_value_bytes[2] = (compensation_value_hex >> 8) & 0xFF;
  compensation_value_bytes[3] = compensation_value_hex & 0xFF;

  HAL_StatusTypeDef status = OEM_WriteRegisters(ec.i2cHandle, ec.devAddr, EC_OEM_REG_TEMP_COMP, compensation_value_bytes, 4);
  
  return status;
}

HAL_StatusTypeDef setDOSalinityCompensation(double compensation_value) {
  // Convert compensation value from double to uint32_t (hex)
  uint32_t compensation_value_hex = (uint32_t)compensation_value;

  // Reverse the byte order of the compensation value
  uint8_t compensation_value_bytes[4];
  compensation_value_bytes[0] = (compensation_value_hex >> 24) & 0xFF;
  compensation_value_bytes[1] = (compensation_value_hex >> 16) & 0xFF;
  compensation_value_bytes[2] = (compensation_value_hex >> 8) & 0xFF;
  compensation_value_bytes[3] = compensation_value_hex & 0xFF;

  HAL_StatusTypeDef status = OEM_WriteRegisters(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_SALINITY_COMP, compensation_value_bytes, 4);
  
  return status;
}

HAL_StatusTypeDef setDOPressureCompensation(double compensation_value) {
  // Convert compensation value from double to uint32_t (hex)
  uint32_t compensation_value_hex = (uint32_t)compensation_value;

  // Reverse the byte order of the compensation value
  uint8_t compensation_value_bytes[4];
  compensation_value_bytes[0] = (compensation_value_hex >> 24) & 0xFF;
  compensation_value_bytes[1] = (compensation_value_hex >> 16) & 0xFF;
  compensation_value_bytes[2] = (compensation_value_hex >> 8) & 0xFF;
  compensation_value_bytes[3] = compensation_value_hex & 0xFF;

  HAL_StatusTypeDef status = OEM_WriteRegisters(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_PRESSURE_COMP, compensation_value_bytes, 4);
  
  return status;
}

HAL_StatusTypeDef setDOTempCompensation(double compensation_value) {
  // Convert compensation value from double to uint32_t (hex)
  uint32_t compensation_value_hex = (uint32_t)compensation_value;

  // Reverse the byte order of the compensation value
  uint8_t compensation_value_bytes[4];
  compensation_value_bytes[0] = (compensation_value_hex >> 24) & 0xFF;
  compensation_value_bytes[1] = (compensation_value_hex >> 16) & 0xFF;
  compensation_value_bytes[2] = (compensation_value_hex >> 8) & 0xFF;
  compensation_value_bytes[3] = compensation_value_hex & 0xFF;

  HAL_StatusTypeDef status = OEM_WriteRegisters(dOxy.i2cHandle, dOxy.devAddr, DO_OEM_REG_TEMP_COMP, compensation_value_bytes, 4);
  
  return status;
}

HAL_StatusTypeDef setPHTempCompensation(double compensation_value) {
  
  // Convert compensation value from double to uint32_t (hex)
  uint32_t compensation_value_hex = (uint32_t)compensation_value;

  // Reverse the byte order of the compensation value
  uint8_t compensation_value_bytes[4];
  compensation_value_bytes[0] = (compensation_value_hex >> 24) & 0xFF;
  compensation_value_bytes[1] = (compensation_value_hex >> 16) & 0xFF;
  compensation_value_bytes[2] = (compensation_value_hex >> 8) & 0xFF;
  compensation_value_bytes[3] = compensation_value_hex & 0xFF;

  HAL_StatusTypeDef status = OEM_WriteRegisters(ph.i2cHandle, ph.devAddr, PH_OEM_REG_TEMP_COMP, compensation_value_bytes, 4);
  
  return status;
}


/* LOW-LEVEL FUNCTIONS */
HAL_StatusTypeDef OEM_ReadRegister(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data)
{
  return HAL_I2C_Mem_Read(i2cHandle, devAddr, reg, I2C_MEMADD_SIZE_8BIT, data, 1, HAL_MAX_DELAY);
}

HAL_StatusTypeDef OEM_ReadRegisters(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data, uint8_t len)
{
  return HAL_I2C_Mem_Read(i2cHandle, devAddr, reg, I2C_MEMADD_SIZE_8BIT, data, len, HAL_MAX_DELAY);
}

HAL_StatusTypeDef OEM_WriteRegister(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data)
{
  return HAL_I2C_Mem_Write(i2cHandle, devAddr, reg, I2C_MEMADD_SIZE_8BIT, data, 1, HAL_MAX_DELAY);
}

HAL_StatusTypeDef OEM_WriteRegisters(I2C_HandleTypeDef *i2cHandle, uint8_t devAddr, uint8_t reg, uint8_t *data, uint8_t len)
{
  return HAL_I2C_Mem_Write(i2cHandle, devAddr, reg, I2C_MEMADD_SIZE_8BIT, data, len, HAL_MAX_DELAY);
}