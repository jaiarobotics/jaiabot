/*	Floating point PID control loop for Microcontrollers
	Copyright (C) 2014 Jesus Ruben Santa Anna Zamudio.

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.

	Author website: http://www.geekfactory.mx
	Author e-mail: ruben at geekfactory dot mx
 */
/*-------------------------------------------------------------*/
/*		Includes and dependencies			*/
/*-------------------------------------------------------------*/
#include <stdbool.h>
#include <stdint.h>

#include <iostream>
#include <sstream>

/*-------------------------------------------------------------*/
/*		Macros and definitions				*/
/*-------------------------------------------------------------*/

/*-------------------------------------------------------------*/
/*		Typedefs enums & structs			*/
/*-------------------------------------------------------------*/

/**
 * Defines if the controler is direct or reverse
 */
enum pid_control_directions {
	E_PID_DIRECT,
	E_PID_REVERSE,
};

struct timespec t0;
bool t0_init = false;

uint64_t t_milliseconds() {
    if (!t0_init) {
        clock_gettime(CLOCK_MONOTONIC_RAW, &t0);
        t0_init = true;
    }

    timespec t;
    clock_gettime(CLOCK_MONOTONIC_RAW, &t);

    return (t.tv_sec - t0.tv_sec) * 1000 + (t.tv_nsec - t0.tv_nsec) / 1000000.0;
}

/**
 * Structure that holds PID all the PID controller data, multiple instances are
 * posible using different structures for each controller
 */
struct Pid {
private:
	// Input, output and setpoint
	float * input; //!< Current Process Value
	float * output; //!< Corrective Output from PID Controller
	float * setpoint; //!< Controller Setpoint
	// Tuning parameters
	float Kp; //!< Stores the gain for the Proportional term
	float Ki; //!< Stores the gain for the Integral term
	float Kd; //!< Stores the gain for the Derivative term
	// Output minimum and maximum values
	float omin; //!< Maximum value allowed at the output
	float omax; //!< Minimum value allowed at the output
	// Variables for PID algorithm
	float iterm; //!< Accumulator for integral term
	float lastin; //!< Last input value for differential term
	// Time related
	uint32_t lasttime; //!< Stores the time when the control loop ran last time
	uint32_t sampletime; //!< Defines the PID sample time
	// Operation mode
	uint8_t automode; //!< Defines if the PID controller is enabled or disabled
	enum pid_control_directions direction;

public:
    Pid(float* in, float* out, float* set, float kp, float ki, float kd) {
        input = in;
        output = out;
        setpoint = set;
        automode = false;

        set_limits(0, 255);

        // Set default sample time to 100 ms
        sampletime = 100;

        set_direction(E_PID_DIRECT);

        tune(kp, ki, kd);

        lasttime = t_milliseconds() - sampletime;
    }

    bool need_compute()
    {
        // Check if the PID period has elapsed
        return(t_milliseconds() - lasttime >= sampletime) ? true : false;
    }

    void compute()
    {
        // Check if control is enabled
        if (!automode)
            return;

        float in = *(input);
        // Compute error
        float error = (*(setpoint)) - in;
        // Compute integral
        iterm += (Ki * error);
        if (iterm > omax)
            iterm = omax;
        else if (iterm < omin)
            iterm = omin;
        // Compute differential on input
        float dinput = in - lastin;
        // Compute PID output
        float out = Kp * error + iterm - Kd * dinput;
        // Apply limit to output value
        if (out > omax)
            out = omax;
        else if (out < omin)
            out = omin;
        // Output to pointed variable
        (*output) = out;
        // Keep track of some variables for next execution
        lastin = in;
        lasttime = t_milliseconds();
    }

    /**
     * @brief Negative PIDs for throttle_depth_pid (Input positive, output negative)
     * 
     */
    void tune(float kp, float ki, float kd)
    {
        // Check for validity
        if (kp < 0 || ki < 0 || kd < 0)
            return;

        //Compute sample time in seconds
        float ssec = ((float) sampletime) / 1000.0;

        Kp = kp;
        Ki = ki * ssec;
        Kd = kd / ssec;

        if (direction == E_PID_REVERSE) {
            Kp = 0 - Kp;
            Ki = 0 - Ki;
            Kd = 0 - Kd;
        }
    }

    float sampletime_sec() { return ((float)sampletime) / 1000.0; }

    float get_Kp() { return Kp; }

    float get_Ki() { return Ki / sampletime_sec(); }

    float get_Kd() { return Kd * sampletime_sec(); }

    float get_setpoint() { return *setpoint; }

    std::string description()
    {
        std::stringstream s;
        s << "PID gains: " << Kp << ", " << Ki << ", " << Kd;
        return s.str();
    }

    void sample(uint32_t time)
    {
        if (time > 0) {
            float ratio = (float) time / (float) sampletime;
            Ki *= ratio;
            Kd /= ratio;
            sampletime = time;
        }
    }

    /**
     * @brief Sets the limits for the PID controller output
     *
     * @param pid The PID controller instance to modify
     * @param min The minimum output value for the PID controller
     * @param max The maximum output value for the PID controller
     */
    void set_limits(float min, float max)
    {
        if (min >= max) return;
        omin = min;
        omax = max;
        //Adjust output to new limits
        if (automode) {
            if (*(output) > omax)
                *(output) = omax;
            else if (*(output) < omin)
                *(output) = omin;

            if (iterm > omax)
                iterm = omax;
            else if (iterm < omin)
                iterm = omin;
        }
    }

    /**
     * @brief Enables automatic control using PID
     *
     * Enables the PID control loop. If manual output adjustment is needed you can
     * disable the PID control loop using pid_manual(). This function enables PID
     * automatic control at program start or after calling pid_manual()
     *
     * @param pid The PID controller instance to enable
     */
    void set_auto()
    {
        // If going from manual to auto
        if (!automode) {
            iterm = *(output);
            lastin = *(input);
            if (iterm > omax)
                iterm = omax;
            else if (iterm < omin)
                iterm = omin;
            automode = true;
        }
    }

    /**
     * @brief Disables automatic process control
     *
     * Disables the PID control loop. User can modify the value of the output
     * variable and the controller will not overwrite it.
     *
     * @param pid The PID controller instance to disable
     */
    void set_manual()
    {
        automode = false;
    }

    /**
     * @brief Configures the PID controller direction
     *
     * Sets the direction of the PID controller. The direction is "DIRECT" when a
     * increase of the output will cause a increase on the measured value and
     * "REVERSE" when a increase on the controller output will cause a decrease on
     * the measured value.
     *
     * @param pid The PID controller instance to modify
     * @param direction The new direction of the PID controller
     */
    void set_direction(enum pid_control_directions dir)
    {
        if (automode && direction != dir) {
            Kp = (0 - Kp);
            Ki = (0 - Ki);
            Kd = (0 - Kd);
        }
        direction = dir;
    }

    void reset_iterm() {
        iterm = 0;
    }

};
