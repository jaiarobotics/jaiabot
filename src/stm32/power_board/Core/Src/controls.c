#include "controls.h"

#include "main.h"

// TIM handles are instantiated by STM32CubeMX in main.c.
extern TIM_HandleTypeDef htim16;

int target_motor_ = 1500;
int max_reverse_ = 1100;
int motor_off_ = 1500;

int rudder_ = 1500;
int port_elevator_ = 1500;
int stbd_elevator_ = 1500;

static bool esc_pwm_started = false;
static uint32_t motor_timeout_ms = 0U;
static uint32_t motor_last_command_ms = 0U;
static bool motor_timeout_active = false;

static uint32_t clamp_u32(uint32_t value, uint32_t min_value, uint32_t max_value)
{
    if (value < min_value)
    {
        return min_value;
    }
    if (value > max_value)
    {
        return max_value;
    }
    return value;
}

static void ensure_esc_pwm_started(void)
{
    if (esc_pwm_started)
    {
        return;
    }

    if (HAL_TIM_PWM_Start(&htim16, TIM_CHANNEL_1) == HAL_OK)
    {
        esc_pwm_started = true;
    }
}

static void apply_motor_output_us(uint32_t pulse_us)
{
    ensure_esc_pwm_started();
    __HAL_TIM_SET_COMPARE(&htim16, TIM_CHANNEL_1, pulse_us);
}

void handle_control_surfaces(const jaiabot_protobuf_ControlSurfaces* control_surfaces)
{
    if (control_surfaces == NULL)
    {
        return;
    }

    target_motor_ = control_surfaces->motor;
    rudder_ = control_surfaces->rudder;
    stbd_elevator_ = control_surfaces->stbd_elevator;
    port_elevator_ = control_surfaces->port_elevator;

    if (control_surfaces->timeout > 0)
    {
        uint32_t timeout_s = (uint32_t)control_surfaces->timeout;
        if (timeout_s > (UINT32_MAX / 1000U))
        {
            motor_timeout_ms = UINT32_MAX;
        }
        else
        {
            motor_timeout_ms = timeout_s * 1000U;
        }

        motor_last_command_ms = HAL_GetTick();
        motor_timeout_active = true;
    }
    else
    {
        motor_timeout_active = false;
    }

    // ESC command is RC-style pulse width in microseconds (typically
    // 1000..2000us, 1500us neutral). TIM16 uses a 1 MHz counter, so CCR1 can
    // be written directly in microseconds.
    uint32_t motor_pulse_us = clamp_u32((uint32_t)target_motor_, 1000U, 2000U);
    apply_motor_output_us(motor_pulse_us);

    // Keep GPIO-level control in this module as well.
    HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin,
                      control_surfaces->led_switch_on ? GPIO_PIN_SET : GPIO_PIN_RESET);

}

void controls_periodic_update(void)
{
    if (!motor_timeout_active)
    {
        return;
    }

    uint32_t elapsed_ms = HAL_GetTick() - motor_last_command_ms;
    if (elapsed_ms >= motor_timeout_ms)
    {
        target_motor_ = motor_off_;
        apply_motor_output_us((uint32_t)motor_off_);
        motor_timeout_active = false;
    }
}

/*
    *** USED TO TURN MOTOR ON AND OFF FOR TESTING ***

    power_board_command_process();

    // HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin, GPIO_PIN_SET);

    PowerBoardResponse power_board_response = jaiabot_protobuf_PowerBoardResponse_init_zero;
    power_board_response.time = (uint64_t)HAL_GetTick() * 1000ULL;
    power_board_response.has_thermocouple_temperature_C = true;
    power_board_response.thermocouple_temperature_C = 20.0f;
    HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_SET);
    HAL_Delay(1);
    power_board_response.has_vccvoltage = true;
    power_board_response.vccvoltage = ADC_TO_VOLTS(adc_read_channel(&hadc1, ADC_CHANNEL_1));
    HAL_GPIO_WritePin(VS_OP_EN_GPIO_Port, VS_OP_EN_Pin, GPIO_PIN_RESET);
    power_board_response.has_vcccurrent = true;
    power_board_response.vcccurrent = ADC_TO_VOLTS(adc_read_channel(&hadc1, ADC_CHANNEL_2));
    power_board_response.has_vvcurrent = true;
    power_board_response.vvcurrent = 0.7f;
    power_board_response.has_motor = true;
    power_board_response.motor = 1550;
    power_board_response.has_thermistor_voltage = true;
    power_board_response.thermistor_voltage = 0.8f;
    power_board_response.has_generic_gpio_voltage = true;
    power_board_response.generic_gpio_voltage = 0.9f;

    usb_transmit(&power_board_response);

*/