#include "eepromM24128.h"
#include "stm32l4xx_hal.h"
#include "stm32l4xx_hal_gpio.h"
#include "stm32l4xx_hal_i2c.h"

int eprmTest(){
  #ifdef EEPROM_FULL_TEST
  //In full test: the mpu writes to all 16000 EEPROM addresses, and prints to serial the register and data read from that register if  VERBOSE_TEST_OUTPUT is defined, then compares it.
  for (int i = 0; i < 16000; i++){
    uint8_t data;
    uint8_t writeVal = i;
    if (eprmWriteCommand(&hi2c1, eprmMemAddr, i, &writeVal)){
      return 1;
    }
    if (eprmReadCommand(&hi2c1, eprmMemAddr, i, &data)){
      return 2;
    }

    #ifdef VERBOSE_TEST_OUTPUT
    printf("reg: %d data: %d\n", i, data);
    #endif
    
    if(data != (uint8_t)i) return 3;
  }
  #endif

  #ifndef EEPROM_FULL_TEST
  //In quick test: the mpu only writes to a single EEPROM address (0x0001) and reads it back, and compares it.
  uint8_t data;
  uint8_t writeVal = 0;

  if (eprmWriteCommand(&hi2c1, eprmMemAddr, 0x0001, &writeVal)){
    return 1;
  }
  if (eprmReadCommand(&hi2c1, eprmMemAddr, 0x0001, &data)){
    return 2;
  }

  #ifdef VERBOSE_TEST_OUTPUT
  printf("EEPROM address 0x0001: %d\n", data);
  #endif

  if (data != 0) return 3;

  writeVal = 42;

  if (eprmWriteCommand(&hi2c1, eprmMemAddr, 0x0001, &writeVal)){
    return 1;
  }
  if (eprmReadCommand(&hi2c1, eprmMemAddr, 0x0001, &data)){
    return 2;
  }

  #ifdef VERBOSE_TEST_OUTPUT
  printf("EEPROM address 0x0001: %d\n", data);
  #endif

  if (data != 42) return 3;

  #endif

  return 0;
}

//Easier to use write command
int eprmWriteCommand(I2C_HandleTypeDef *port, uint16_t eprmAddr, uint16_t regAddr, uint8_t *data){
  HAL_GPIO_WritePin(WC_EN_GPIO_Port, WC_EN_Pin, GPIO_PIN_RESET);

  if (HAL_I2C_Mem_Write(port, eprmAddr, regAddr, 2, data, 1, HAL_MAX_DELAY) != HAL_OK) {
    return 1;
  }

  HAL_Delay(6);

  HAL_GPIO_WritePin(WC_EN_GPIO_Port, WC_EN_Pin, GPIO_PIN_SET);
  return 0;
}

//Easier to use read command
int eprmReadCommand(I2C_HandleTypeDef *port, uint16_t eprmAddr, uint16_t regAddr, uint8_t *data){

  if (HAL_I2C_Mem_Read(port, eprmAddr, regAddr, 2, data, 1, HAL_MAX_DELAY) != HAL_OK) {
    return 1;
  }

  return 0;
}