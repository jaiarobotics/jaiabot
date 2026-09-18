#ifndef CONTROLS_H   
#define CONTROLS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>

    typedef struct _jaiabot_protobuf_ControlSurfaces jaiabot_protobuf_ControlSurfaces;

    // Motor
    extern int target_motor_;
    extern int max_reverse_;
    extern int motor_off_;

    // Rudder and Elevators
    extern int rudder_;
    extern int port_elevator_;
    extern int stbd_elevator_;

    // Applies incoming control-surface commands from the host link to local
    // actuator outputs (GPIO / PWM) and cached state.
    void handle_control_surfaces(const jaiabot_protobuf_ControlSurfaces* control_surfaces);

    // Runs control watchdog checks that should be serviced from the main loop.
    void controls_periodic_update(void);

    // Returns true once after a command timeout has neutralized the outputs.
    bool controls_take_timeout_event(void);

    // Returns the motor pulse width (microseconds) currently being driven to
    // the ESC, after ramping/clamping, for telemetry reporting.
    int controls_get_motor_actual(void);

#ifdef __cplusplus
}
#endif

#endif // CONTROLS_H