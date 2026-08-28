/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
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
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "fatfs.h"
#include "usb_device.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "usbd_cdc_if.h"
#include <string.h>
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
ADC_HandleTypeDef hadc1;

I2C_HandleTypeDef hi2c1;
I2C_HandleTypeDef hi2c2;

IWDG_HandleTypeDef hiwdg;

LPTIM_HandleTypeDef hlptim1;

UART_HandleTypeDef hlpuart1;
UART_HandleTypeDef huart1;
UART_HandleTypeDef huart2;

QSPI_HandleTypeDef hqspi;

RTC_HandleTypeDef hrtc;

SPI_HandleTypeDef hspi1;

TIM_HandleTypeDef htim2;
TIM_HandleTypeDef htim15;
TIM_HandleTypeDef htim16;

/* USER CODE BEGIN PV */
static volatile uint8_t lptim_wake_flag = 0;
static volatile uint8_t reed_wake_flag = 0;

/* LSI ~32 kHz, LPTIM prescaler /128 -> 250 Hz. */
#define LPTIM_TICK_HZ            250U
#define LPTIM_MAX_COUNTS         65536U
#define SLEEP_INTERVAL_MS        10000U

uint8_t bits_in_byte = 8;
bool usb_tx_busy = false;
enum state current_state = REED_WAIT_STATE;
static volatile uint32_t sleep_interval_ms = SLEEP_INTERVAL_MS;
static volatile uint32_t requested_low_power_ms = 0U;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_ADC1_Init(void);
static void MX_I2C1_Init(void);
static void MX_I2C2_Init(void);
static void MX_IWDG_Init(void);
static void MX_LPUART1_UART_Init(void);
static void MX_USART1_UART_Init(void);
static void MX_USART2_UART_Init(void);
static void MX_QUADSPI_Init(void);
static void MX_RTC_Init(void);
static void MX_SPI1_Init(void);
static void MX_TIM2_Init(void);
static void MX_TIM15_Init(void);
static void MX_TIM16_Init(void);
static void MX_LPTIM1_Init(void);
/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

static bool adc_read_channel(ADC_HandleTypeDef *hadc, uint32_t channel, uint32_t *raw)
{
    ADC_ChannelConfTypeDef sConfig = {0};
    sConfig.Channel = channel;
    sConfig.Rank = ADC_REGULAR_RANK_1;
    sConfig.SamplingTime = ADC_SAMPLETIME_92CYCLES_5;
    sConfig.SingleDiff = ADC_SINGLE_ENDED;
    sConfig.OffsetNumber = ADC_OFFSET_NONE;
    sConfig.Offset = 0;

    // Bounded timeout so a misconfigured/failed conversion can't hang the
    // main loop forever
    const uint32_t adc_poll_timeout_ms = 10U;

    if (HAL_ADC_ConfigChannel(hadc, &sConfig) != HAL_OK)
    {
      return false;
    }
    if (HAL_ADC_Start(hadc) != HAL_OK)
    {
      return false;
    }
    if (HAL_ADC_PollForConversion(hadc, adc_poll_timeout_ms) != HAL_OK)
    {
        HAL_ADC_Stop(hadc);
      return false;
    }
    *raw = HAL_ADC_GetValue(hadc);
    HAL_ADC_Stop(hadc);
    return true;
}

#define ADC_TO_VOLTS(raw) ((raw) / 4095.0f * 3.3f)
// VCC_V_SENSE uses the same battery-sense divider calibration as the former
// Arduino implementation: analogRead(VccVoltage) * 0.0306.
#define ADC_TO_BATTERY_VOLTS(raw) ((raw) * 0.00503f)

static void power_board_build_telemetry(PowerBoardResponse *response)
{
  response->time = (uint64_t)HAL_GetTick() * 1000ULL;

  // // Enable the battery-sense rail and op-amp only while measuring VCC.
  // HAL_GPIO_WritePin(VS_VBATT_EN_GPIO_Port, VS_VBATT_EN_Pin, GPIO_PIN_SET);
  // HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_SET);
  HAL_Delay(10);
  uint32_t vcc_raw = 0U;
  response->has_vccvoltage = true;
  adc_read_channel(&hadc1, ADC_CHANNEL_1, &vcc_raw);
  response->vccvoltage = ADC_TO_BATTERY_VOLTS(vcc_raw);
  response->has_vccvoltage_raw = true;
  response->vccvoltage_raw = vcc_raw;
  response->has_vcccurrent = true;
  uint32_t vcc_current_raw = 0U;
  adc_read_channel(&hadc1, ADC_CHANNEL_2, &vcc_current_raw);
  response->vcccurrent = ADC_TO_VOLTS(vcc_current_raw);
  // HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_RESET);
  // HAL_GPIO_WritePin(VS_VBATT_EN_GPIO_Port, VS_VBATT_EN_Pin, GPIO_PIN_RESET);

  uint32_t vv_current_raw = 0U;
  response->has_vvcurrent = true;
  adc_read_channel(&hadc1, ADC_CHANNEL_3, &vv_current_raw);
  response->vvcurrent = ADC_TO_VOLTS(vv_current_raw);

  uint32_t thermistor_raw = 0U;
  response->has_thermistor_voltage = true;
  adc_read_channel(&hadc1, ADC_CHANNEL_10, &thermistor_raw);
  response->thermistor_voltage = ADC_TO_VOLTS(thermistor_raw);

  uint32_t generic_gpio_raw = 0U;
  response->has_generic_gpio_voltage = true;
  adc_read_channel(&hadc1, ADC_CHANNEL_13, &generic_gpio_raw);
  response->generic_gpio_voltage = ADC_TO_VOLTS(generic_gpio_raw);

  response->has_motor = true;
  response->motor = controls_get_motor_actual();
}

static bool low_power_request_pending(void)
{
  return requested_low_power_ms != 0U;
}

static uint32_t take_low_power_request_ms(void)
{
  uint32_t duration_ms = requested_low_power_ms;
  requested_low_power_ms = 0U;

  return duration_ms;
}

static void service_host_commands(uint32_t budget_ms)
{
  uint32_t start = HAL_GetTick();

  do
  {
    power_board_command_process();
    controls_periodic_update();
    HAL_IWDG_Refresh(&hiwdg);
    if (low_power_request_pending())
    {
      break;
    }
    HAL_Delay(5);
  } while ((HAL_GetTick() - start) < budget_ms);
}

static uint64_t lptim_counts_from_ms(uint32_t duration_ms)
{
  uint64_t counts = ((uint64_t)duration_ms * LPTIM_TICK_HZ + 999U) / 1000U;

  return (counts == 0U) ? 1U : counts;
}

static void wait_for_reed_wake(void)
{
  const uint16_t period = (uint16_t)(lptim_counts_from_ms(SLEEP_INTERVAL_MS) - 1U);
  lptim_wake_flag = 0U;
  reed_wake_flag = 0U;

  if (HAL_LPTIM_Counter_Start_IT(&hlptim1, period) != HAL_OK)
  {
    Error_Handler();
  }

  HAL_SuspendTick();
  while (reed_wake_flag == 0U && lptim_wake_flag == 0U)
  {
    HAL_PWREx_EnterSTOP2Mode(PWR_STOPENTRY_WFI);
    SystemClock_Config();
  }
  HAL_ResumeTick();

  HAL_LPTIM_Counter_Stop_IT(&hlptim1);
  HAL_IWDG_Refresh(&hiwdg);
}

static void sleep_until_lptim_wake_counts(uint16_t period)
{
  lptim_wake_flag = 0U;

  if (HAL_LPTIM_Counter_Start_IT(&hlptim1, period) != HAL_OK)
  {
    Error_Handler();
  }

  HAL_SuspendTick();
  while (lptim_wake_flag == 0U)
  {
    // Process any host command frame completed by USB IRQ before
    // re-entering low-power sleep.
    power_board_command_process();
    controls_periodic_update();
    if (low_power_request_pending())
    {
      break;
    }

    HAL_PWREx_EnterSTOP2Mode(PWR_STOPENTRY_WFI);
    SystemClock_Config();
    HAL_IWDG_Refresh(&hiwdg);
  }
  HAL_ResumeTick();

  HAL_LPTIM_Counter_Stop_IT(&hlptim1);
}

static void sleep_for_ms(uint32_t duration_ms)
{
  uint64_t remaining_counts = lptim_counts_from_ms(duration_ms);

  while (remaining_counts > 0U)
  {
    uint32_t chunk_counts = (remaining_counts > LPTIM_MAX_COUNTS) ? LPTIM_MAX_COUNTS : (uint32_t)remaining_counts;
    sleep_until_lptim_wake_counts((uint16_t)(chunk_counts - 1U));
    if (low_power_request_pending())
    {
      return;
    }
    remaining_counts -= chunk_counts;
  }
}

static void power_board_enter_low_power_mode(uint32_t duration_ms)
{
  extern USBD_HandleTypeDef hUsbDeviceFS;

  target_motor_ = motor_off_;
  controls_periodic_update();

  HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(LED_G_GPIO_Port, LED_G_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(LED_B_GPIO_Port, LED_B_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_RESET);
  // HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_SET); // THIS IS CURRENTLY BACKWARDS. THE OP-AMP ENABLE IS ACTIVE HIGH, BUT THE PCB HAS IT ACTIVE LOW. SO WE'RE JUST INVERTING IT HERE.
  HAL_GPIO_WritePin(VS_VBATT_EN_GPIO_Port, VS_VBATT_EN_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(EN_12V_REG_GPIO_Port, EN_12V_REG_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(EN_5V_REG_GPIO_Port, EN_5V_REG_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(UVOV_EN_GPIO_Port, UVOV_EN_Pin, GPIO_PIN_RESET);

  USBD_Stop(&hUsbDeviceFS);
  USBD_DeInit(&hUsbDeviceFS);

  sleep_for_ms(duration_ms);

  HAL_GPIO_WritePin(UVOV_EN_GPIO_Port, UVOV_EN_Pin, GPIO_PIN_SET);
  HAL_GPIO_WritePin(EN_12V_REG_GPIO_Port, EN_12V_REG_Pin, GPIO_PIN_SET);
  HAL_GPIO_WritePin(EN_5V_REG_GPIO_Port, EN_5V_REG_Pin, GPIO_PIN_SET);
  HAL_GPIO_WritePin(VS_VBATT_EN_GPIO_Port, VS_VBATT_EN_Pin, GPIO_PIN_SET);

  HAL_Delay(300);
  MX_USB_DEVICE_Init();
}



static void power_board_disable_external_power(void)
{
  target_motor_ = motor_off_;
  controls_periodic_update();

  HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(LED_G_GPIO_Port, LED_G_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(LED_B_GPIO_Port, LED_B_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(VS_VBATT_EN_GPIO_Port, VS_VBATT_EN_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(EN_12V_REG_GPIO_Port, EN_12V_REG_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(EN_5V_REG_GPIO_Port, EN_5V_REG_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(EN_3V3_REG_GPIO_Port, EN_3V3_REG_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(UVOV_EN_GPIO_Port, UVOV_EN_Pin, GPIO_PIN_RESET);
}

static void power_board_enable_external_power(void)
{
  HAL_GPIO_WritePin(UVOV_EN_GPIO_Port, UVOV_EN_Pin, GPIO_PIN_SET);
  HAL_Delay(300);

  HAL_GPIO_WritePin(EN_12V_REG_GPIO_Port, EN_12V_REG_Pin, GPIO_PIN_SET);
  HAL_GPIO_WritePin(EN_5V_REG_GPIO_Port, EN_5V_REG_Pin, GPIO_PIN_SET);
  HAL_GPIO_WritePin(EN_3V3_REG_GPIO_Port, EN_3V3_REG_Pin, GPIO_PIN_SET);
  HAL_GPIO_WritePin(VS_VBATT_EN_GPIO_Port, VS_VBATT_EN_Pin, GPIO_PIN_SET);
  
  HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_RESET); // Needs to be RESET to enable the op-amp
}

/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{

  /* USER CODE BEGIN 1 */

  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_ADC1_Init();
  MX_I2C1_Init();
  MX_I2C2_Init();
  MX_IWDG_Init();
  MX_LPUART1_UART_Init();
  MX_USART1_UART_Init();
  MX_USART2_UART_Init();
  MX_QUADSPI_Init();
  MX_RTC_Init();
  MX_SPI1_Init();
  MX_TIM2_Init();
  MX_TIM15_Init();
  MX_TIM16_Init();
  MX_FATFS_Init();
  MX_USB_DEVICE_Init();
  MX_LPTIM1_Init();
  /* USER CODE BEGIN 2 */

  // HAL_PWREx_EnterSTOP2Mode(PWR_STOPENTRY_WFI);   /* DEEP SLEEP for current measurement */

  power_board_disable_external_power();

  /* Allow USB host time to enumerate the CDC device before the first TX. */
  HAL_Delay(2000);

  init_crc32_table();
  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  
  // 20Hz loop
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */

    HAL_IWDG_Refresh(&hiwdg);

    // Dispatch complete USB commands while the board is awake.
    power_board_command_process();

    // Always service the motor ramp/timeout, regardless of state, so it
    // keeps stepping toward target_motor_ (e.g. ramping down to neutral)
    controls_periodic_update();
    if (controls_take_timeout_event())
    {
      power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode_POWER_BOARD_TIMEOUT);
    }

    // State loop: short command-service window while awake, then sleep.
    switch(current_state)
    {
      case REED_WAIT_STATE:
        {
          static uint8_t reed_active_samples = 0U;
          
          if (HAL_GPIO_ReadPin(REED_WAKE_GPIO_Port, REED_WAKE_Pin) ==
              REED_WAKE_ACTIVE_STATE)
          {
            ++reed_active_samples;
            if (reed_active_samples >= 3U) 
            {
              power_board_enable_external_power();
              current_state = INIT_STATE;
            }
          }
          else
          {
            reed_active_samples = 0U;
            wait_for_reed_wake();
          }
        }
        break;

      case INIT_STATE:
        {
          // Guarded so this only runs once at boot, not on every wake from
          // SLEEP_STATE: calibrate the ADC before any telemetry reads rely
          // on it, and let the host know we just came up.
          static bool did_startup_init = false;

          if (!did_startup_init)
          {
            did_startup_init = true;
            bool init_failed = (HAL_ADCEx_Calibration_Start(&hadc1, ADC_SINGLE_ENDED) != HAL_OK);

            PowerBoardResponse startup_response = jaiabot_protobuf_PowerBoardResponse_init_zero;
            startup_response.time = (uint64_t)HAL_GetTick() * 1000ULL;
            startup_response.which_data = jaiabot_protobuf_PowerBoardResponse_metadata_tag;
            startup_response.data.metadata.has_init_failed = true;
            startup_response.data.metadata.init_failed = init_failed;
            startup_response.data.metadata.has_power_board_version = true;
            startup_response.data.metadata.power_board_version = 1;
            usb_transmit(&startup_response);
            power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode_POWER_BOARD_STARTUP);
          }
        }

        current_state = BROADCAST_STATE;

        break;

      case BROADCAST_STATE:
        // Send telemetry only in response to a valid control-surfaces command.
        if (power_board_take_telemetry_request())
        {
          PowerBoardResponse telemetry_response = jaiabot_protobuf_PowerBoardResponse_init_zero;
          power_board_build_telemetry(&telemetry_response);
          usb_transmit(&telemetry_response);
        }

        break;

      case SLEEP_STATE:
        // A host request overrides the normal periodic sleep interval. Consume
        // it before sleeping so it does not immediately interrupt the LPTIM
        // wait; a newly received request can still interrupt and reschedule.
        {
          uint32_t sleep_duration_ms = take_low_power_request_ms();
          if (sleep_duration_ms == 0U)
          {
            sleep_duration_ms = power_board_get_sleep_interval_ms();
          }

          power_board_enter_low_power_mode(sleep_duration_ms);
          current_state = low_power_request_pending() ? SLEEP_STATE : INIT_STATE;
        }
        break;

      default:
        current_state = INIT_STATE;
    }

    HAL_Delay(50);
  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Configure the main internal regulator output voltage
  */
  if (HAL_PWREx_ControlVoltageScaling(PWR_REGULATOR_VOLTAGE_SCALE1) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI48|RCC_OSCILLATORTYPE_HSI
                              |RCC_OSCILLATORTYPE_LSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSI48State = RCC_HSI48_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.LSIState = RCC_LSI_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL.PLLM = 4;
  RCC_OscInitStruct.PLL.PLLN = 48;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV7;
  RCC_OscInitStruct.PLL.PLLQ = RCC_PLLQ_DIV6;
  RCC_OscInitStruct.PLL.PLLR = RCC_PLLR_DIV8;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV1;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_1) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief ADC1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_ADC1_Init(void)
{

  /* USER CODE BEGIN ADC1_Init 0 */

  /* USER CODE END ADC1_Init 0 */

  ADC_ChannelConfTypeDef sConfig = {0};

  /* USER CODE BEGIN ADC1_Init 1 */

  /* USER CODE END ADC1_Init 1 */

  /** Common config
  */
  hadc1.Instance = ADC1;
  hadc1.Init.ClockPrescaler = ADC_CLOCK_ASYNC_DIV1;
  hadc1.Init.Resolution = ADC_RESOLUTION_12B;
  hadc1.Init.DataAlign = ADC_DATAALIGN_RIGHT;
  hadc1.Init.ScanConvMode = ADC_SCAN_DISABLE;
  hadc1.Init.EOCSelection = ADC_EOC_SINGLE_CONV;
  hadc1.Init.LowPowerAutoWait = DISABLE;
  hadc1.Init.ContinuousConvMode = DISABLE;
  hadc1.Init.NbrOfConversion = 1;
  hadc1.Init.DiscontinuousConvMode = DISABLE;
  hadc1.Init.ExternalTrigConv = ADC_SOFTWARE_START;
  hadc1.Init.ExternalTrigConvEdge = ADC_EXTERNALTRIGCONVEDGE_NONE;
  hadc1.Init.DMAContinuousRequests = DISABLE;
  hadc1.Init.Overrun = ADC_OVR_DATA_PRESERVED;
  hadc1.Init.OversamplingMode = DISABLE;
  if (HAL_ADC_Init(&hadc1) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Regular Channel
  */
  sConfig.Channel = ADC_CHANNEL_1;
  sConfig.Rank = ADC_REGULAR_RANK_1;
  sConfig.SamplingTime = ADC_SAMPLETIME_2CYCLES_5;
  sConfig.SingleDiff = ADC_SINGLE_ENDED;
  sConfig.OffsetNumber = ADC_OFFSET_NONE;
  sConfig.Offset = 0;
  if (HAL_ADC_ConfigChannel(&hadc1, &sConfig) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN ADC1_Init 2 */

  /* USER CODE END ADC1_Init 2 */

}

/**
  * @brief I2C1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_I2C1_Init(void)
{

  /* USER CODE BEGIN I2C1_Init 0 */

  /* USER CODE END I2C1_Init 0 */

  /* USER CODE BEGIN I2C1_Init 1 */

  /* USER CODE END I2C1_Init 1 */
  hi2c1.Instance = I2C1;
  hi2c1.Init.Timing = 0x00805C87;
  hi2c1.Init.OwnAddress1 = 0;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c1.Init.OwnAddress2 = 0;
  hi2c1.Init.OwnAddress2Masks = I2C_OA2_NOMASK;
  hi2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  if (HAL_I2C_Init(&hi2c1) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Analogue filter
  */
  if (HAL_I2CEx_ConfigAnalogFilter(&hi2c1, I2C_ANALOGFILTER_ENABLE) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Digital filter
  */
  if (HAL_I2CEx_ConfigDigitalFilter(&hi2c1, 0) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN I2C1_Init 2 */

  /* USER CODE END I2C1_Init 2 */

}

/**
  * @brief I2C2 Initialization Function
  * @param None
  * @retval None
  */
static void MX_I2C2_Init(void)
{

  /* USER CODE BEGIN I2C2_Init 0 */

  /* USER CODE END I2C2_Init 0 */

  /* USER CODE BEGIN I2C2_Init 1 */

  /* USER CODE END I2C2_Init 1 */
  hi2c2.Instance = I2C2;
  hi2c2.Init.Timing = 0x00805C87;
  hi2c2.Init.OwnAddress1 = 0;
  hi2c2.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c2.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c2.Init.OwnAddress2 = 0;
  hi2c2.Init.OwnAddress2Masks = I2C_OA2_NOMASK;
  hi2c2.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c2.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  if (HAL_I2C_Init(&hi2c2) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Analogue filter
  */
  if (HAL_I2CEx_ConfigAnalogFilter(&hi2c2, I2C_ANALOGFILTER_ENABLE) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Digital filter
  */
  if (HAL_I2CEx_ConfigDigitalFilter(&hi2c2, 0) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN I2C2_Init 2 */

  /* USER CODE END I2C2_Init 2 */

}

/**
  * @brief IWDG Initialization Function
  * @param None
  * @retval None
  */
static void MX_IWDG_Init(void)
{

  /* USER CODE BEGIN IWDG_Init 0 */

  /* USER CODE END IWDG_Init 0 */

  /* USER CODE BEGIN IWDG_Init 1 */

  /* USER CODE END IWDG_Init 1 */
  hiwdg.Instance = IWDG;
  /* Main loop sleeps ~10s per iteration (LPTIM_10SEC_PERIOD) waiting on the
   * low-power timer, refreshing the watchdog once per wake. PRESCALER_256
   * gives a ~32.7s timeout (4096 / (32kHz LSI / 256)), comfortably covering
   * that sleep with margin. */
  hiwdg.Init.Prescaler = IWDG_PRESCALER_256;
  hiwdg.Init.Window = 4095;
  hiwdg.Init.Reload = 4095;
  if (HAL_IWDG_Init(&hiwdg) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN IWDG_Init 2 */

  /* USER CODE END IWDG_Init 2 */

}

/**
  * @brief LPTIM1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_LPTIM1_Init(void)
{

  /* USER CODE BEGIN LPTIM1_Init 0 */

  /* USER CODE END LPTIM1_Init 0 */

  /* USER CODE BEGIN LPTIM1_Init 1 */

  /* USER CODE END LPTIM1_Init 1 */
  hlptim1.Instance = LPTIM1;
  hlptim1.Init.Clock.Source = LPTIM_CLOCKSOURCE_APBCLOCK_LPOSC;
  hlptim1.Init.Clock.Prescaler = LPTIM_PRESCALER_DIV128;
  hlptim1.Init.Trigger.Source = LPTIM_TRIGSOURCE_SOFTWARE;
  hlptim1.Init.OutputPolarity = LPTIM_OUTPUTPOLARITY_HIGH;
  hlptim1.Init.UpdateMode = LPTIM_UPDATE_IMMEDIATE;
  hlptim1.Init.CounterSource = LPTIM_COUNTERSOURCE_INTERNAL;
  hlptim1.Init.Input1Source = LPTIM_INPUT1SOURCE_GPIO;
  hlptim1.Init.Input2Source = LPTIM_INPUT2SOURCE_GPIO;
  if (HAL_LPTIM_Init(&hlptim1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN LPTIM1_Init 2 */

  /* USER CODE END LPTIM1_Init 2 */

}

/**
  * @brief LPUART1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_LPUART1_UART_Init(void)
{

  /* USER CODE BEGIN LPUART1_Init 0 */

  /* USER CODE END LPUART1_Init 0 */

  /* USER CODE BEGIN LPUART1_Init 1 */

  /* USER CODE END LPUART1_Init 1 */
  hlpuart1.Instance = LPUART1;
  hlpuart1.Init.BaudRate = 209700;
  hlpuart1.Init.WordLength = UART_WORDLENGTH_7B;
  hlpuart1.Init.StopBits = UART_STOPBITS_1;
  hlpuart1.Init.Parity = UART_PARITY_NONE;
  hlpuart1.Init.Mode = UART_MODE_TX_RX;
  hlpuart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  hlpuart1.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
  hlpuart1.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
  if (HAL_UART_Init(&hlpuart1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN LPUART1_Init 2 */

  /* USER CODE END LPUART1_Init 2 */

}

/**
  * @brief USART1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART1_UART_Init(void)
{

  /* USER CODE BEGIN USART1_Init 0 */

  /* USER CODE END USART1_Init 0 */

  /* USER CODE BEGIN USART1_Init 1 */

  /* USER CODE END USART1_Init 1 */
  huart1.Instance = USART1;
  huart1.Init.BaudRate = 115200;
  huart1.Init.WordLength = UART_WORDLENGTH_8B;
  huart1.Init.StopBits = UART_STOPBITS_1;
  huart1.Init.Parity = UART_PARITY_NONE;
  huart1.Init.Mode = UART_MODE_TX_RX;
  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
  huart1.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
  huart1.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
  if (HAL_UART_Init(&huart1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART1_Init 2 */

  /* USER CODE END USART1_Init 2 */

}

/**
  * @brief USART2 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART2_UART_Init(void)
{

  /* USER CODE BEGIN USART2_Init 0 */

  /* USER CODE END USART2_Init 0 */

  /* USER CODE BEGIN USART2_Init 1 */

  /* USER CODE END USART2_Init 1 */
  huart2.Instance = USART2;
  huart2.Init.BaudRate = 115200;
  huart2.Init.WordLength = UART_WORDLENGTH_8B;
  huart2.Init.StopBits = UART_STOPBITS_1;
  huart2.Init.Parity = UART_PARITY_NONE;
  huart2.Init.Mode = UART_MODE_TX_RX;
  huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart2.Init.OverSampling = UART_OVERSAMPLING_16;
  huart2.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
  huart2.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
  if (HAL_UART_Init(&huart2) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART2_Init 2 */

  /* USER CODE END USART2_Init 2 */

}

/**
  * @brief QUADSPI Initialization Function
  * @param None
  * @retval None
  */
static void MX_QUADSPI_Init(void)
{

  /* USER CODE BEGIN QUADSPI_Init 0 */

  /* USER CODE END QUADSPI_Init 0 */

  /* USER CODE BEGIN QUADSPI_Init 1 */

  /* USER CODE END QUADSPI_Init 1 */
  /* QUADSPI parameter configuration*/
  hqspi.Instance = QUADSPI;
  hqspi.Init.ClockPrescaler = 255;
  hqspi.Init.FifoThreshold = 1;
  hqspi.Init.SampleShifting = QSPI_SAMPLE_SHIFTING_NONE;
  hqspi.Init.FlashSize = 1;
  hqspi.Init.ChipSelectHighTime = QSPI_CS_HIGH_TIME_1_CYCLE;
  hqspi.Init.ClockMode = QSPI_CLOCK_MODE_0;
  hqspi.Init.FlashID = QSPI_FLASH_ID_1;
  hqspi.Init.DualFlash = QSPI_DUALFLASH_DISABLE;
  if (HAL_QSPI_Init(&hqspi) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN QUADSPI_Init 2 */

  /* USER CODE END QUADSPI_Init 2 */

}

/**
  * @brief RTC Initialization Function
  * @param None
  * @retval None
  */
static void MX_RTC_Init(void)
{

  /* USER CODE BEGIN RTC_Init 0 */

  /* USER CODE END RTC_Init 0 */

  /* USER CODE BEGIN RTC_Init 1 */

  /* USER CODE END RTC_Init 1 */

  /** Initialize RTC Only
  */
  hrtc.Instance = RTC;
  hrtc.Init.HourFormat = RTC_HOURFORMAT_24;
  hrtc.Init.AsynchPrediv = 127;
  hrtc.Init.SynchPrediv = 255;
  hrtc.Init.OutPut = RTC_OUTPUT_DISABLE;
  hrtc.Init.OutPutRemap = RTC_OUTPUT_REMAP_NONE;
  hrtc.Init.OutPutPolarity = RTC_OUTPUT_POLARITY_HIGH;
  hrtc.Init.OutPutType = RTC_OUTPUT_TYPE_OPENDRAIN;
  if (HAL_RTC_Init(&hrtc) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN RTC_Init 2 */

  /* USER CODE END RTC_Init 2 */

}

/**
  * @brief SPI1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_SPI1_Init(void)
{

  /* USER CODE BEGIN SPI1_Init 0 */

  /* USER CODE END SPI1_Init 0 */

  /* USER CODE BEGIN SPI1_Init 1 */

  /* USER CODE END SPI1_Init 1 */
  /* SPI1 parameter configuration*/
  hspi1.Instance = SPI1;
  hspi1.Init.Mode = SPI_MODE_MASTER;
  hspi1.Init.Direction = SPI_DIRECTION_2LINES;
  hspi1.Init.DataSize = SPI_DATASIZE_4BIT;
  hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;
  hspi1.Init.CLKPhase = SPI_PHASE_1EDGE;
  hspi1.Init.NSS = SPI_NSS_SOFT;
  hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_2;
  hspi1.Init.FirstBit = SPI_FIRSTBIT_MSB;
  hspi1.Init.TIMode = SPI_TIMODE_DISABLE;
  hspi1.Init.CRCCalculation = SPI_CRCCALCULATION_DISABLE;
  hspi1.Init.CRCPolynomial = 7;
  hspi1.Init.CRCLength = SPI_CRC_LENGTH_DATASIZE;
  hspi1.Init.NSSPMode = SPI_NSS_PULSE_ENABLE;
  if (HAL_SPI_Init(&hspi1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN SPI1_Init 2 */

  /* USER CODE END SPI1_Init 2 */

}

/**
  * @brief TIM2 Initialization Function
  * @param None
  * @retval None
  */
static void MX_TIM2_Init(void)
{

  /* USER CODE BEGIN TIM2_Init 0 */

  /* USER CODE END TIM2_Init 0 */

  TIM_ClockConfigTypeDef sClockSourceConfig = {0};
  TIM_MasterConfigTypeDef sMasterConfig = {0};
  TIM_OC_InitTypeDef sConfigOC = {0};

  /* USER CODE BEGIN TIM2_Init 1 */

  /* USER CODE END TIM2_Init 1 */
  htim2.Instance = TIM2;
  htim2.Init.Prescaler = 0;
  htim2.Init.CounterMode = TIM_COUNTERMODE_UP;
  htim2.Init.Period = 4294967295;
  htim2.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
  htim2.Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_DISABLE;
  if (HAL_TIM_Base_Init(&htim2) != HAL_OK)
  {
    Error_Handler();
  }
  sClockSourceConfig.ClockSource = TIM_CLOCKSOURCE_INTERNAL;
  if (HAL_TIM_ConfigClockSource(&htim2, &sClockSourceConfig) != HAL_OK)
  {
    Error_Handler();
  }
  if (HAL_TIM_PWM_Init(&htim2) != HAL_OK)
  {
    Error_Handler();
  }
  sMasterConfig.MasterOutputTrigger = TIM_TRGO_RESET;
  sMasterConfig.MasterSlaveMode = TIM_MASTERSLAVEMODE_DISABLE;
  if (HAL_TIMEx_MasterConfigSynchronization(&htim2, &sMasterConfig) != HAL_OK)
  {
    Error_Handler();
  }
  sConfigOC.OCMode = TIM_OCMODE_PWM1;
  sConfigOC.Pulse = 0;
  sConfigOC.OCPolarity = TIM_OCPOLARITY_HIGH;
  sConfigOC.OCFastMode = TIM_OCFAST_DISABLE;
  if (HAL_TIM_PWM_ConfigChannel(&htim2, &sConfigOC, TIM_CHANNEL_1) != HAL_OK)
  {
    Error_Handler();
  }
  if (HAL_TIM_PWM_ConfigChannel(&htim2, &sConfigOC, TIM_CHANNEL_2) != HAL_OK)
  {
    Error_Handler();
  }
  if (HAL_TIM_PWM_ConfigChannel(&htim2, &sConfigOC, TIM_CHANNEL_3) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN TIM2_Init 2 */

  /* USER CODE END TIM2_Init 2 */
  HAL_TIM_MspPostInit(&htim2);

}

/**
  * @brief TIM15 Initialization Function
  * @param None
  * @retval None
  */
static void MX_TIM15_Init(void)
{

  /* USER CODE BEGIN TIM15_Init 0 */

  /* USER CODE END TIM15_Init 0 */

  TIM_MasterConfigTypeDef sMasterConfig = {0};
  TIM_IC_InitTypeDef sConfigIC = {0};

  /* USER CODE BEGIN TIM15_Init 1 */

  /* USER CODE END TIM15_Init 1 */
  htim15.Instance = TIM15;
  htim15.Init.Prescaler = 0;
  htim15.Init.CounterMode = TIM_COUNTERMODE_UP;
  htim15.Init.Period = 65535;
  htim15.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
  htim15.Init.RepetitionCounter = 0;
  htim15.Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_DISABLE;
  if (HAL_TIM_IC_Init(&htim15) != HAL_OK)
  {
    Error_Handler();
  }
  sMasterConfig.MasterOutputTrigger = TIM_TRGO_RESET;
  sMasterConfig.MasterSlaveMode = TIM_MASTERSLAVEMODE_DISABLE;
  if (HAL_TIMEx_MasterConfigSynchronization(&htim15, &sMasterConfig) != HAL_OK)
  {
    Error_Handler();
  }
  sConfigIC.ICPolarity = TIM_INPUTCHANNELPOLARITY_RISING;
  sConfigIC.ICSelection = TIM_ICSELECTION_DIRECTTI;
  sConfigIC.ICPrescaler = TIM_ICPSC_DIV1;
  sConfigIC.ICFilter = 0;
  if (HAL_TIM_IC_ConfigChannel(&htim15, &sConfigIC, TIM_CHANNEL_1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN TIM15_Init 2 */

  /* USER CODE END TIM15_Init 2 */

}

/**
  * @brief TIM16 Initialization Function
  * @param None
  * @retval None
  */
static void MX_TIM16_Init(void)
{

  /* USER CODE BEGIN TIM16_Init 0 */

  /* USER CODE END TIM16_Init 0 */

  TIM_OC_InitTypeDef sConfigOC = {0};
  TIM_BreakDeadTimeConfigTypeDef sBreakDeadTimeConfig = {0};

  /* USER CODE BEGIN TIM16_Init 1 */

  /* USER CODE END TIM16_Init 1 */
  htim16.Instance = TIM16;
  htim16.Init.Prescaler = 0;
  htim16.Init.CounterMode = TIM_COUNTERMODE_UP;
  htim16.Init.Period = 65535;
  htim16.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
  htim16.Init.RepetitionCounter = 0;
  htim16.Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_DISABLE;
  if (HAL_TIM_Base_Init(&htim16) != HAL_OK)
  {
    Error_Handler();
  }
  if (HAL_TIM_PWM_Init(&htim16) != HAL_OK)
  {
    Error_Handler();
  }
  sConfigOC.OCMode = TIM_OCMODE_PWM1;
  sConfigOC.Pulse = 0;
  sConfigOC.OCPolarity = TIM_OCPOLARITY_HIGH;
  sConfigOC.OCNPolarity = TIM_OCNPOLARITY_HIGH;
  sConfigOC.OCFastMode = TIM_OCFAST_DISABLE;
  sConfigOC.OCIdleState = TIM_OCIDLESTATE_RESET;
  sConfigOC.OCNIdleState = TIM_OCNIDLESTATE_RESET;
  if (HAL_TIM_PWM_ConfigChannel(&htim16, &sConfigOC, TIM_CHANNEL_1) != HAL_OK)
  {
    Error_Handler();
  }
  sBreakDeadTimeConfig.OffStateRunMode = TIM_OSSR_DISABLE;
  sBreakDeadTimeConfig.OffStateIDLEMode = TIM_OSSI_DISABLE;
  sBreakDeadTimeConfig.LockLevel = TIM_LOCKLEVEL_OFF;
  sBreakDeadTimeConfig.DeadTime = 0;
  sBreakDeadTimeConfig.BreakState = TIM_BREAK_DISABLE;
  sBreakDeadTimeConfig.BreakPolarity = TIM_BREAKPOLARITY_HIGH;
  sBreakDeadTimeConfig.AutomaticOutput = TIM_AUTOMATICOUTPUT_DISABLE;
  if (HAL_TIMEx_ConfigBreakDeadTime(&htim16, &sBreakDeadTimeConfig) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN TIM16_Init 2 */

  /* USER CODE END TIM16_Init 2 */
  HAL_TIM_MspPostInit(&htim16);

}

/**
  * @brief GPIO Initialization Function
  * @param None
  * @retval None
  */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};
  /* USER CODE BEGIN MX_GPIO_Init_1 */
  /* USER CODE END MX_GPIO_Init_1 */

  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOE_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOH_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();
  __HAL_RCC_GPIOD_CLK_ENABLE();

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOE, RS232_EN_Pin|RS232_FOFF_Pin|UVOV_EN_Pin|VS_OP_EN_Pin
                          |VS_VBATT_EN_Pin|EN_5V_REG_Pin|WC_EN_Pin|EXT_LED_CTRL_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOD, BLE_RSTn_Pin|LED_B_Pin|LED_G_Pin|EN_12V_REG_Pin
                          |EN_3V3_REG_Pin|RTC_VCC_EN_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOC, EXT_5V_CTRL_Pin|RUDDER_Pin|LED_R_Pin|CTRL_ACTS_Pin
                          |EXT_12V_CTRL_Pin|RS232_INV_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(EXT_5V_FAULT_GPIO_Port, EXT_5V_FAULT_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(EXT_LED_FAULT_GPIO_Port, EXT_LED_FAULT_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin : PPS_Pin */
  GPIO_InitStruct.Pin = PPS_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(PPS_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pins : RS232_EN_Pin RS232_FOFF_Pin UVOV_EN_Pin VS_OP_EN_Pin
                           VS_VBATT_EN_Pin EN_5V_REG_Pin WC_EN_Pin EXT_LED_CTRL_Pin */
  GPIO_InitStruct.Pin = RS232_EN_Pin|RS232_FOFF_Pin|UVOV_EN_Pin|VS_OP_EN_Pin
                          |VS_VBATT_EN_Pin|EN_5V_REG_Pin|WC_EN_Pin|EXT_LED_CTRL_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOE, &GPIO_InitStruct);

  /*Configure GPIO pin : UVOV_FAULT_Pin */
  GPIO_InitStruct.Pin = UVOV_FAULT_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(UVOV_FAULT_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pins : BLE_RSTn_Pin LED_B_Pin LED_G_Pin EN_12V_REG_Pin
                           EN_3V3_REG_Pin RTC_VCC_EN_Pin */
  GPIO_InitStruct.Pin = BLE_RSTn_Pin|LED_B_Pin|LED_G_Pin|EN_12V_REG_Pin
                          |EN_3V3_REG_Pin|RTC_VCC_EN_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOD, &GPIO_InitStruct);

  /*Configure GPIO pins : TURN_ON_SEL_Pin CFG1_Pin CFG0_Pin USB_SENSE_Pin
                           EXT_12V_FAULT_Pin */
  GPIO_InitStruct.Pin = TURN_ON_SEL_Pin|CFG1_Pin|CFG0_Pin|USB_SENSE_Pin
                          |EXT_12V_FAULT_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(GPIOD, &GPIO_InitStruct);

  /*Configure GPIO pins : EXT_5V_CTRL_Pin RUDDER_Pin LED_R_Pin CTRL_ACTS_Pin
                           EXT_12V_CTRL_Pin RS232_INV_Pin */
  GPIO_InitStruct.Pin = EXT_5V_CTRL_Pin|RUDDER_Pin|LED_R_Pin|CTRL_ACTS_Pin
                          |EXT_12V_CTRL_Pin|RS232_INV_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

  /*Configure GPIO pin : FAULT_ACTS_Pin */
  GPIO_InitStruct.Pin = FAULT_ACTS_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(FAULT_ACTS_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pin : EXT_5V_FAULT_Pin */
  GPIO_InitStruct.Pin = EXT_5V_FAULT_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(EXT_5V_FAULT_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pin : EXT_LED_FAULT_Pin */
  GPIO_InitStruct.Pin = EXT_LED_FAULT_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(EXT_LED_FAULT_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pin : RTC_INT_Pin */
  GPIO_InitStruct.Pin = RTC_INT_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(RTC_INT_GPIO_Port, &GPIO_InitStruct);

  /* USER CODE BEGIN MX_GPIO_Init_2 */
  GPIO_InitStruct.Pin = REED_WAKE_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(REED_WAKE_GPIO_Port, &GPIO_InitStruct);
  HAL_NVIC_SetPriority(EXTI15_10_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(EXTI15_10_IRQn);
  /* USER CODE END MX_GPIO_Init_2 */
}

/* USER CODE BEGIN 4 */
void HAL_LPTIM_AutoReloadMatchCallback(LPTIM_HandleTypeDef *hlptim)
{
  if (hlptim->Instance == LPTIM1)
  {
    lptim_wake_flag = 1U;
  }
}

void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{
  if (GPIO_Pin == REED_WAKE_Pin)
  {
    reed_wake_flag = 1U;
  }
}

void power_board_set_sleep_interval_ms(uint32_t interval_ms)
{
  sleep_interval_ms = (interval_ms == 0U) ? 1U : interval_ms;
}

void power_board_set_sleep_interval_seconds(uint32_t interval_s)
{
  if (interval_s > (UINT32_MAX / 1000U))
  {
    power_board_set_sleep_interval_ms(UINT32_MAX);
    return;
  }

  power_board_set_sleep_interval_ms(interval_s * 1000U);
}

uint32_t power_board_get_sleep_interval_ms(void)
{
  return sleep_interval_ms;
}

void power_board_request_low_power_mode_ms(uint32_t duration_ms)
{
  requested_low_power_ms = (duration_ms == 0U) ? 1U : duration_ms;
}

void power_board_request_low_power_mode_seconds(uint32_t duration_s)
{
  current_state = SLEEP_STATE;
  if (duration_s > (UINT32_MAX / 1000U))
  {
    power_board_request_low_power_mode_ms(UINT32_MAX);
    return;
  }

  power_board_request_low_power_mode_ms(duration_s * 1000U);
}

// Jumps to the STM32 ROM bootloader (system memory), which on this part
// (STM32L433) re-enumerates the USB peripheral as a DFU device so the
// application can be reflashed with dfu-util over the same USB cable.
// Do not erase the application before the jump. If the ROM bootloader fails
// to start, erasing the vector table would leave the board unable to recover
// without an SWD programmer.
void jumpToBootloader(void)
{
  __disable_irq();

  extern USBD_HandleTypeDef hUsbDeviceFS;
  USBD_DeInit(&hUsbDeviceFS);

  SysTick->CTRL = 0;
  SysTick->LOAD = 0;
  SysTick->VAL = 0;

  HAL_DeInit();
  HAL_RCC_DeInit();

  SCB->VTOR = (uint32_t)BOOTVTAB;

  for (uint8_t i = 0; i < (sizeof(NVIC->ICER) / sizeof(NVIC->ICER[0])); i++)
  {
    NVIC->ICER[i] = 0xFFFFFFFF;
    NVIC->ICPR[i] = 0xFFFFFFFF;
  }

  __set_MSP(BOOTVTAB->Initial_SP);

  BOOTVTAB->Reset_Handler();
}
/* USER CODE END 4 */

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  __disable_irq();
  while (1)
  {
  }
  /* USER CODE END Error_Handler_Debug */
}
#ifdef USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
