/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2024 STMicroelectronics.
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

#include "command.h"
#include "MS5837.h"
#include "celsius_tsys01.h"
#include "oem_library.h"
#include "cfluor.h"
#include "aml.h"
#include "math.h"

#include <stdlib.h>
#include <pb_encode.h>
#include <pb_decode.h>

#include "jaiabot/messages/sensor/sensor_core.pb.h"

/* USER CODE END Includes */

/* Exported types ------------------------------------------------------------*/
/* USER CODE BEGIN ET */
struct boot_vectable_ {
    uint32_t Initial_SP;
    void (*Reset_Handler)(void);
};

/* USER CODE END ET */

/* Exported constants --------------------------------------------------------*/
/* USER CODE BEGIN EC */

/* USER CODE END EC */

/* Exported macro ------------------------------------------------------------*/
/* USER CODE BEGIN EM */
#define BOOT_ADDR 0x1FFF0000
#define MCU_IRQS  70u
#define BOOTVTAB  ((struct boot_vectable_ *)BOOT_ADDR)
#define MAX_MSG_SIZE 256
/* USER CODE END EM */

/* Exported functions prototypes ---------------------------------------------*/
void Error_Handler(void);

/* USER CODE BEGIN EFP */

/* USER CODE END EFP */

/* Private defines -----------------------------------------------------------*/
#define THERMISTOR_Pin GPIO_PIN_1
#define THERMISTOR_GPIO_Port GPIOC
#define PHASE_C_Pin GPIO_PIN_0
#define PHASE_C_GPIO_Port GPIOA
#define AN_NTC_PH_Pin GPIO_PIN_4
#define AN_NTC_PH_GPIO_Port GPIOA
#define PDIS_PH_EN_Pin GPIO_PIN_5
#define PDIS_PH_EN_GPIO_Port GPIOA
#define AN_NTC_DO_Pin GPIO_PIN_4
#define AN_NTC_DO_GPIO_Port GPIOC
#define OC2_Pin GPIO_PIN_5
#define OC2_GPIO_Port GPIOC
#define OC2_EXTI_IRQn EXTI9_5_IRQn
#define SC1_Pin GPIO_PIN_0
#define SC1_GPIO_Port GPIOB
#define OC1_Pin GPIO_PIN_1
#define OC1_GPIO_Port GPIOB
#define PDIS_DO_EN_Pin GPIO_PIN_2
#define PDIS_DO_EN_GPIO_Port GPIOB
#define PDIS_EC_EN_Pin GPIO_PIN_12
#define PDIS_EC_EN_GPIO_Port GPIOB
#define WC_EN_Pin GPIO_PIN_13
#define WC_EN_GPIO_Port GPIOB
#define GPIO1_Pin GPIO_PIN_15
#define GPIO1_GPIO_Port GPIOB
#define RS232_INV_Pin GPIO_PIN_9
#define RS232_INV_GPIO_Port GPIOC
#define PHASE_A_Pin GPIO_PIN_8
#define PHASE_A_GPIO_Port GPIOA
#define LED1_Pin GPIO_PIN_10
#define LED1_GPIO_Port GPIOC
#define LED2_Pin GPIO_PIN_11
#define LED2_GPIO_Port GPIOC
#define LED3_Pin GPIO_PIN_12
#define LED3_GPIO_Port GPIOC
#define SC2_Pin GPIO_PIN_2
#define SC2_GPIO_Port GPIOD
#define PHASE_B_Pin GPIO_PIN_8
#define PHASE_B_GPIO_Port GPIOB
#define PPS_Pin GPIO_PIN_9
#define PPS_GPIO_Port GPIOB
#define PPS_EXTI_IRQn EXTI9_5_IRQn

/* USER CODE BEGIN Private defines */

typedef enum SensorStates {
    UNINITIALIZED = 0,
    INITIALIZED = 1,
    REQUESTED = 2,
    FAILED = 3,
    STOPPED = 4,
} SensorStates;

typedef jaiabot_sensor_protobuf_Metadata Metadata;
typedef jaiabot_sensor_protobuf_BlueRoboticsBar30 BlueRoboticsBar30;
typedef jaiabot_sensor_protobuf_AtlasScientificOEMEC AtlasScientificOEMEC;
typedef jaiabot_sensor_protobuf_AtlasScientificOEMDO AtlasScientificOEMDO;
typedef jaiabot_sensor_protobuf_AtlasScientificOEMpH AtlasScientificOEMPH;
typedef jaiabot_sensor_protobuf_TurnerCFluor TurnerCFluor;
typedef jaiabot_sensor_protobuf_AML Aml;
typedef jaiabot_sensor_protobuf_TSYS01 Tsys01;

extern float adc_voltage1;
extern float adc_voltage2;
extern float adc_voltage3;
extern float adc_voltage4;
extern float adc_voltage5;
/* USER CODE END Private defines */

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
