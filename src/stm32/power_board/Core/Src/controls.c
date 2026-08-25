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

// motor_min_forward/motor_min_reverse: the smallest pulse offset from
// neutral needed for the ESC to actually engage. These are near-neutral
// thresholds, NOT the same as max_reverse_, which is the far outer safety
// limit (e.g. 1100us == -100% throttle) applied by the host driver.
static const int motor_min_forward_ = 1600;
static const int motor_min_reverse_ = 1400;

// Max change in microseconds applied to the motor per ramp step
static const int motor_max_step_ = 12;

// Time between ramp steps (20 Hz)
static const uint32_t motor_ramp_interval_ms_ = 50U;

static int motor_tracked_ = 1500;
static int motor_actual_ = 1500;
static uint32_t motor_last_ramp_ms_ = 0U;

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

static int min_int(int a, int b) { return (a < b) ? a : b; }

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

static void apply_motor_output_us(int pulse_us)
{
    ensure_esc_pwm_started();
    __HAL_TIM_SET_COMPARE(&htim16, TIM_CHANNEL_1, clamp_u32((uint32_t)pulse_us, 1000U, 2000U));
}

// Only clamps values that are actively driving the motor; neutral always
// passes through so the motor can stop regardless of the forward/reverse
// bound currently in effect.
static int motor_forward_clamp(int value)
{
    if (value == motor_off_)
        return motor_off_;
    if (value < motor_min_forward_)
        return motor_min_forward_;
    return value;
}

static int motor_reverse_clamp(int value)
{
    if (value == motor_off_)
        return motor_off_;
    if (value > motor_min_reverse_)
        return motor_min_reverse_;
    return value;
}

// Steps motor_tracked_ toward target_motor_ by at most motor_max_step_ so
// the ESC sees a ramp rather than an instantaneous jump
static void step_motor_toward_target(void)
{
    if (target_motor_ > motor_off_ && target_motor_ > motor_tracked_)
    {
        motor_tracked_ += min_int(target_motor_ - motor_tracked_, motor_max_step_);
        motor_actual_ = motor_forward_clamp(motor_tracked_);
    }
    else if ((target_motor_ > motor_off_ && target_motor_ < motor_tracked_) ||
             (target_motor_ == motor_off_ && motor_tracked_ > motor_off_))
    {
        motor_tracked_ -= min_int(motor_tracked_ - target_motor_, motor_max_step_);
        motor_actual_ = motor_forward_clamp(motor_tracked_);
    }
    else if ((target_motor_ < motor_off_ && target_motor_ > motor_tracked_) ||
             (target_motor_ == motor_off_ && motor_tracked_ < motor_off_))
    {
        motor_tracked_ += min_int(target_motor_ - motor_tracked_, motor_max_step_);
        motor_actual_ = motor_reverse_clamp(motor_tracked_);
    }
    else if (target_motor_ < motor_off_ && target_motor_ < motor_tracked_)
    {
        motor_tracked_ -= min_int(motor_tracked_ - target_motor_, motor_max_step_);
        motor_actual_ = motor_reverse_clamp(motor_tracked_);
    }

    apply_motor_output_us(motor_actual_);
}

int controls_get_motor_actual(void) { return motor_actual_; }

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

    // Keep GPIO-level control in this module as well.
    HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin,
                      control_surfaces->led_switch_on ? GPIO_PIN_SET : GPIO_PIN_RESET);

}

void controls_periodic_update(void)
{
    if (motor_timeout_active && (HAL_GetTick() - motor_last_command_ms) >= motor_timeout_ms)
    {
        motor_timeout_active = false;
        target_motor_ = motor_off_;
        HAL_GPIO_WritePin(LED_R_GPIO_Port, LED_R_Pin, GPIO_PIN_RESET);
    }

    if ((HAL_GetTick() - motor_last_ramp_ms_) >= motor_ramp_interval_ms_)
    {
        motor_last_ramp_ms_ = HAL_GetTick();
        step_motor_toward_target();
    }
}