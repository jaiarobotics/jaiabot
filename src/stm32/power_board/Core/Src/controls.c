#include "controls.h"

#include "main.h"

// TIM handles are instantiated by STM32CubeMX in main.c.
extern TIM_HandleTypeDef htim16;

int target_motor_us = 1500;

int rudder_us = 1500;
int port_elevator_us = 1500;
int stbd_elevator_us = 1500;

// Smallest pulse offset from neutral that engages the ESC.
// Not the same as the host driver's max reverse limit.
static const int motor_min_forward_us = 1600;
static const int motor_min_reverse_us = 1400;

// Max change in microseconds applied to the motor per ramp step
static const int motor_max_step_us = 12;

// Time between ramp steps (20 Hz)
static const uint32_t motor_ramp_interval_ms = 50U;

static int motor_ramped_us = 1500;
static int motor_output_us = 1500;
static uint32_t motor_last_ramp_ms = 0U;

static bool esc_pwm_started = false;
static uint32_t motor_timeout_ms = 0U;
static uint32_t motor_last_command_ms = 0U;
static bool motor_timeout_active = false;
static bool motor_timeout_event_pending = false;

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

static int min_int(int a, int b) { return (a < b) ? a : b; }

static void ensure_esc_pwm_started(void)
{
    if (esc_pwm_started)
    {
        return;
    }

    // TIM16 is initialized lazily (only after the reed switch closes), so
    // this can be called before htim16 is set up; skip until it is ready.
    if (htim16.Instance == NULL)
    {
        return;
    }

    if (HAL_TIM_PWM_Start(&htim16, TIM_CHANNEL_1) == HAL_OK)
    {
        esc_pwm_started = true;
    }
}

static void apply_motor_output_us(int pulse_us)
{
    ensure_esc_pwm_started();

    if (htim16.Instance == NULL)
    {
        return;
    }

    __HAL_TIM_SET_COMPARE(&htim16, TIM_CHANNEL_1, clamp_u32((uint32_t)pulse_us, 1000U, 2000U));
}

// Only clamps values that drive the motor; neutral always passes so it can stop.
static int motor_forward_clamp(int value)
{
    if (value == MOTOR_NEUTRAL_US)
        return MOTOR_NEUTRAL_US;
    if (value < motor_min_forward_us)
        return motor_min_forward_us;
    return value;
}

static int motor_reverse_clamp(int value)
{
    if (value == MOTOR_NEUTRAL_US)
        return MOTOR_NEUTRAL_US;
    if (value > motor_min_reverse_us)
        return motor_min_reverse_us;
    return value;
}

// Ramps motor_ramped_us toward target_motor_us by at most motor_max_step_us.
// Clamping follows motor_ramped_us's sign so reversals ramp through neutral.
static void step_motor_toward_target(void)
{
    if (target_motor_us > MOTOR_NEUTRAL_US && target_motor_us > motor_ramped_us)
    {
        motor_ramped_us += min_int(target_motor_us - motor_ramped_us, motor_max_step_us);
    }
    else if ((target_motor_us > MOTOR_NEUTRAL_US && target_motor_us < motor_ramped_us) ||
             (target_motor_us == MOTOR_NEUTRAL_US && motor_ramped_us > MOTOR_NEUTRAL_US))
    {
        motor_ramped_us -= min_int(motor_ramped_us - target_motor_us, motor_max_step_us);
    }
    else if ((target_motor_us < MOTOR_NEUTRAL_US && target_motor_us > motor_ramped_us) ||
             (target_motor_us == MOTOR_NEUTRAL_US && motor_ramped_us < MOTOR_NEUTRAL_US))
    {
        motor_ramped_us += min_int(target_motor_us - motor_ramped_us, motor_max_step_us);
    }
    else if (target_motor_us < MOTOR_NEUTRAL_US && target_motor_us < motor_ramped_us)
    {
        motor_ramped_us -= min_int(motor_ramped_us - target_motor_us, motor_max_step_us);
    }

    if (motor_ramped_us > MOTOR_NEUTRAL_US)
        motor_output_us = motor_forward_clamp(motor_ramped_us);
    else if (motor_ramped_us < MOTOR_NEUTRAL_US)
        motor_output_us = motor_reverse_clamp(motor_ramped_us);
    else
        motor_output_us = MOTOR_NEUTRAL_US;

    apply_motor_output_us(motor_output_us);
}

int controls_get_motor_output(void) { return motor_output_us; }

void controls_stop_outputs(void)
{
    if (esc_pwm_started)
    {
        HAL_TIM_PWM_Stop(&htim16, TIM_CHANNEL_1);
        esc_pwm_started = false;
    }

    // Power is about to be cut, so drop straight to neutral rather than
    // resuming a ramp from a stale pulse width after waking.
    target_motor_us = MOTOR_NEUTRAL_US;
    motor_ramped_us = MOTOR_NEUTRAL_US;
    motor_output_us = MOTOR_NEUTRAL_US;
    motor_timeout_active = false;
    motor_timeout_event_pending = false;
}

void handle_control_surfaces(const jaiabot_protobuf_ControlSurfaces* control_surfaces)
{
    if (control_surfaces == NULL)
    {
        return;
    }

    target_motor_us = control_surfaces->motor;
    rudder_us = control_surfaces->rudder;
    stbd_elevator_us = control_surfaces->stbd_elevator;
    port_elevator_us = control_surfaces->port_elevator;

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

    // Keep GPIO-level control in this module as well.
    HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin,
                      control_surfaces->led_switch_on ? GPIO_PIN_SET : GPIO_PIN_RESET);

}

void controls_periodic_update(void)
{
    if (motor_timeout_active && (HAL_GetTick() - motor_last_command_ms) >= motor_timeout_ms)
    {
        motor_timeout_active = false;
        target_motor_us = MOTOR_NEUTRAL_US;
        rudder_us = 1500;
        stbd_elevator_us = 1500;
        port_elevator_us = 1500;
        motor_timeout_event_pending = true;
    }

    if ((HAL_GetTick() - motor_last_ramp_ms) >= motor_ramp_interval_ms)
    {
        motor_last_ramp_ms = HAL_GetTick();
        step_motor_toward_target();
    }
}

bool controls_take_timeout_event(void)
{
    bool timeout_event = motor_timeout_event_pending;
    motor_timeout_event_pending = false;
    return timeout_event;
}