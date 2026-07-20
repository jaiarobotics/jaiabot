/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2025 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */

/* Define to prevent recursive inclusion -------------------------------------*/
#ifndef __MAIN_H
#define __MAIN_H

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include "stm32l4xx_hal.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */

#include "crc32.h"
#include "cobs.h"
#include "serial.h"
#include "controls.h"
#include "icas.h"
#include "ble.h"
#include "command.h"

#include <pb_encode.h>
#include "jaiabot/messages/power_board/power_board.pb.h"

/* USER CODE END Includes */

#define VERBOSE_OUTPUT          // Extra output for the system over serial. Not used for the tests
#define VERBOSE_TEST_OUTPUT     // Extra output for system tests

#define COMP_TEST               // Enable-Disable for the componant test system state
#define SOFT_TEST               // Enable-Disable for the software test system state
#define MAIN_DISABLE            // Enable-Disable for the main system state

#define EEPROM_FULL_TEST        // Selects between the EEPROM Quick Test or EEPROM Full Test (quick test writes to 1 address, Full test writes to all addresses 0-15999)

#define LOOP_COMP_TEST          // Loops the componant test system state. When enabled, the system will not run code in the software test or main system states.
#define IDLE_COMP_TEST          // Go into the idle system state upon completion of the componant test system state

#define COMP_USB_TEST           //USB test enable
//#define COMP_BLE_TEST         //BLE test enable
#define COMP_RTC_TEST           //RTC test enable
#define COMP_EEPROM_TEST        //EEPROM test enable

/* Exported types ------------------------------------------------------------*/
/* USER CODE BEGIN ET */
struct boot_vectable_ {
    uint32_t Initial_SP;
    void (*Reset_Handler)(void);
};

typedef jaiabot_protobuf_PowerBoardResponse PowerBoardResponse;
/* USER CODE END ET */

/* Exported constants --------------------------------------------------------*/
/* USER CODE BEGIN EC */
extern uint8_t bits_in_byte;
extern bool usb_tx_busy;
/* USER CODE END EC */

/* Exported macro ------------------------------------------------------------*/
/* USER CODE BEGIN EM */
#define MAX_MSG_SIZE 256
#define BOOT_ADDR 0x1FFF0000
#define BOOTVTAB  ((struct boot_vectable_ *)BOOT_ADDR)
/* USER CODE END EM */

void HAL_TIM_MspPostInit(TIM_HandleTypeDef *htim);

/* Exported functions prototypes ---------------------------------------------*/
void Error_Handler(void);

/* USER CODE BEGIN EFP */
void jumpToBootloader(void);
/* USER CODE END EFP */

/* Private defines -----------------------------------------------------------*/
#define PPS_Pin GPIO_PIN_2
#define PPS_GPIO_Port GPIOE
#define RS232_EN_Pin GPIO_PIN_3
#define RS232_EN_GPIO_Port GPIOE
#define RS232_FOFF_Pin GPIO_PIN_4
#define RS232_FOFF_GPIO_Port GPIOE
#define UVOV_FAULT_Pin GPIO_PIN_5
#define UVOV_FAULT_GPIO_Port GPIOE
#define UVOV_EN_Pin GPIO_PIN_6
#define UVOV_EN_GPIO_Port GPIOE
#define REED_WAKE_Pin GPIO_PIN_13
#define REED_WAKE_GPIO_Port GPIOC
#define VCC_V_SENSE_Pin GPIO_PIN_0
#define VCC_V_SENSE_GPIO_Port GPIOC
#define VCC_CURR_SENSE_Pin GPIO_PIN_1
#define VCC_CURR_SENSE_GPIO_Port GPIOC
#define SYS_CURR_SENSE_Pin GPIO_PIN_2
#define SYS_CURR_SENSE_GPIO_Port GPIOC
#define EXTI_WAKE_Pin GPIO_PIN_0
#define EXTI_WAKE_GPIO_Port GPIOA
#define EXT_5V_PWM_Pin GPIO_PIN_1
#define EXT_5V_PWM_GPIO_Port GPIOA
#define VCC_MID_SENSE_Pin GPIO_PIN_4
#define VCC_MID_SENSE_GPIO_Port GPIOA
#define THERMISTOR_Pin GPIO_PIN_5
#define THERMISTOR_GPIO_Port GPIOA
#define EXT_AN_Pin GPIO_PIN_4
#define EXT_AN_GPIO_Port GPIOC
#define VS_OP_EN_Pin GPIO_PIN_7
#define VS_OP_EN_GPIO_Port GPIOE
#define VS_VBATT_EN_Pin GPIO_PIN_8
#define VS_VBATT_EN_GPIO_Port GPIOE
#define EN_5V_REG_Pin GPIO_PIN_9
#define EN_5V_REG_GPIO_Port GPIOE
#define EXT_LED_PWM_Pin GPIO_PIN_10
#define EXT_LED_PWM_GPIO_Port GPIOB
#define PHASE_A_Pin GPIO_PIN_14
#define PHASE_A_GPIO_Port GPIOB
#define BLE_RSTn_Pin GPIO_PIN_8
#define BLE_RSTn_GPIO_Port GPIOD
#define LED_B_Pin GPIO_PIN_9
#define LED_B_GPIO_Port GPIOD
#define LED_G_Pin GPIO_PIN_10
#define LED_G_GPIO_Port GPIOD
#define TURN_ON_SEL_Pin GPIO_PIN_11
#define TURN_ON_SEL_GPIO_Port GPIOD
#define CFG1_Pin GPIO_PIN_12
#define CFG1_GPIO_Port GPIOD
#define CFG0_Pin GPIO_PIN_14
#define CFG0_GPIO_Port GPIOD
#define EXT_5V_CTRL_Pin GPIO_PIN_6
#define EXT_5V_CTRL_GPIO_Port GPIOC
#define FAULT_ACTS_Pin GPIO_PIN_7
#define FAULT_ACTS_GPIO_Port GPIOC
#define RUDDER_Pin GPIO_PIN_8
#define RUDDER_GPIO_Port GPIOC
#define LED_R_Pin GPIO_PIN_9
#define LED_R_GPIO_Port GPIOC
#define EXT_5V_FAULT_Pin GPIO_PIN_8
#define EXT_5V_FAULT_GPIO_Port GPIOA
#define EXT_12V_PWM_Pin GPIO_PIN_15
#define EXT_12V_PWM_GPIO_Port GPIOA
#define CTRL_ACTS_Pin GPIO_PIN_10
#define CTRL_ACTS_GPIO_Port GPIOC
#define EXT_12V_CTRL_Pin GPIO_PIN_11
#define EXT_12V_CTRL_GPIO_Port GPIOC
#define RS232_INV_Pin GPIO_PIN_12
#define RS232_INV_GPIO_Port GPIOC
#define EN_12V_REG_Pin GPIO_PIN_0
#define EN_12V_REG_GPIO_Port GPIOD
#define USB_SENSE_Pin GPIO_PIN_1
#define USB_SENSE_GPIO_Port GPIOD
#define EN_3V3_REG_Pin GPIO_PIN_2
#define EN_3V3_REG_GPIO_Port GPIOD
#define RTC_VCC_EN_Pin GPIO_PIN_4
#define RTC_VCC_EN_GPIO_Port GPIOD
#define EXT_12V_FAULT_Pin GPIO_PIN_7
#define EXT_12V_FAULT_GPIO_Port GPIOD
#define EXT_LED_FAULT_Pin GPIO_PIN_4
#define EXT_LED_FAULT_GPIO_Port GPIOB
#define ESC_PWM_Pin GPIO_PIN_8
#define ESC_PWM_GPIO_Port GPIOB
#define RTC_INT_Pin GPIO_PIN_9
#define RTC_INT_GPIO_Port GPIOB
#define WC_EN_Pin GPIO_PIN_0
#define WC_EN_GPIO_Port GPIOE
#define EXT_LED_CTRL_Pin GPIO_PIN_1
#define EXT_LED_CTRL_GPIO_Port GPIOE

//state machine states
enum state{
  INIT_STATE,
  COMP_TEST_STATE,
  SOFT_TEST_STATE,
  MAIN_STATE,
  IDLE_STATE
};

//test states for the COMP_TEST_STATE system state
enum testState{
  USB_TEST,
  BLE_TEST,
  RTC_TEST,
  EEPROM_TEST
};

/* USER CODE BEGIN Private defines */

/* USER CODE END Private defines */

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
