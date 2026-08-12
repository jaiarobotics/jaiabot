#ifndef CONTROLS_H   
#define CONTROLS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>

// Motor
extern int target_motor_;
extern int max_reverse_;
extern int motor_off_;

// Rudder and Elevators
extern int rudder_;
extern int port_elevator_;
extern int stbd_elevator_;

#ifdef __cplusplus
}
#endif

#endif // CONTROLS_H