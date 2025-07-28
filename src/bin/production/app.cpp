// Copyright 2022:
//   JaiaRobotics LLC
// File authors:
//   Kanz Giwa
//   Kaitlyn Habib
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#include <goby/middleware/marshalling/protobuf.h>
#include <cstdlib>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>
#include <goby/middleware/application/interface.h>
#include <goby/middleware/application/tool.h>
#include "config.pb.h"
#include "jaiabot/groups.h"
#include <chrono>
#include <sstream>
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/motor.pb.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"
#include "jaiabot/messages/production.pb.h"
#include "jaiabot/messages/simulator.pb.h"
#include "jaiabot/messages/high_control.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::JaiabotProduction>;

namespace jaiabot
{
namespace apps
{

class JaiabotProduction: public ApplicationBase
{
    public:
        JaiabotProduction();

    private:
        // Test state for IMU sensor
        bool imu_data_received_ = false;
        bool imu_reset_pending_ = false;
        bool imu_reset_complete_ = false;
        bool test_imu_ = false;

        // tracks timestamps for IMU messages and resets
        goby::time::SystemClock::time_point imu_reset_start_time_;
        goby::time::SystemClock::time_point last_imu_msg_time_;

        // reboot imu
        void reboot_bno085_imu() { system("sudo systemctl start jaia_firm_bno085_reset_gpio_pin_py.service"); }

        // Declare functions
        void imu_sensor_data_timeCheck();
        void imu_sensor_reset_check();
        void pressure_sensor();
        void pressure_sensor_reset_check();
        void clear_all_test_responses();


        // test state for Pressure sensor
        bool pressure_test_passed_ = false;
        bool pressure_data_received_ = false;
        bool pressure_reset_complete_ = false;
        bool pressure_reset_pending_ = false;
        double latest_pressure_ = 100.0;
        bool test_pressure_ = false;
        goby::time::SystemClock::time_point pressure_reset_start_time_;
        goby::time::SystemClock::time_point last_pressure_msg_time_;
        bool pressure_data_resumed_ = false;
        
        // restart pressure
        void restart_pressure_py() { system("sudo systemctl restart jaiabot_pressure_sensor_py.service"); }

        // Motor Test State
        
        bool motor_test_passed_ = false;
        bool motor_data_received_ = false;
        bool motor_test_running_ = false;
        bool motor_command_sent_ = false;
        double latest_rpm_ = 0.0;
        double latest_temperature_ = 0.0;
        goby::time::SystemClock::time_point motor_test_start_time_;

        void motor_harness();
        
        bool test_motor_ = false;
        
        jaiabot::protobuf::ProductionResponse response;
        
        // Declare the loop
        void loop() override;

        // Helper function calculates how many seconds have passed since a specific time point
        double seconds_since(const goby::time::SystemClock::time_point& timestamp)
        {
            using namespace std::chrono;
            return duration_cast<duration<double>>(goby::time::SystemClock::now() - timestamp).count();
        }
    };

} //namespace apps
} //namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::JaiabotProduction>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::JaiabotProduction>(argc, argv));
}

jaiabot::apps::JaiabotProduction::JaiabotProduction() : ApplicationBase(5.0 * si::hertz)
{
    // Subscribe to IMU data
    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const jaiabot::protobuf::IMUData& imu_msg)
        {

            last_imu_msg_time_ = goby::time::SystemClock::now();
            imu_data_received_ = true;
            
            /*might need later
            if (imu_msg.has_euler_angles() && imu_msg.euler_angles().has_heading())
            {
                // imu_heading_
                double heading = imu_msg.euler_angles().heading();
                /*if (heading >= 0 && heading <= 360)
                {
                    imu_test_passed_ = true;
                }
            }*/
        });

        // Subscribe to pressure sensor data
        interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pt)
        {
            pressure_data_received_ = true;
            latest_pressure_ = pt.pressure_raw();
            last_pressure_msg_time_ = goby::time::SystemClock::now();
            if (latest_pressure_ < 0.2)
            {
                pressure_test_passed_ = true;
            }

        });

    // Subscribe to motor status    
    interprocess().subscribe<jaiabot::groups::motor_status>(
        [this](const jaiabot::protobuf::Motor& motor_msg)
        {
            motor_data_received_ = true;
            latest_rpm_ = motor_msg.rpm();
            if (motor_msg.has_thermistor() && motor_msg.thermistor().has_temperature())
            {
                latest_temperature_ = motor_msg.thermistor().temperature();
            }
            if (motor_test_running_)
            {
                if (latest_rpm_ >= 3600 &&
                    latest_temperature_ >= 10 && latest_temperature_ <= 30)
                {
                    motor_test_passed_ = true;
                }
            }
        });

       // Subscribe to production
       interprocess().subscribe<jaiabot::groups::production_request>(
           [this](const jaiabot::protobuf::ProductionRequest& production_msg)
           {
            // Set raw timestamp
            const auto now = std::chrono::system_clock::now();
            const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
                now.time_since_epoch()).count();
            response.set_time(timestamp_us);
            
            // Set production command in response
            response.set_production_command(production_msg.production_command());
            
            switch (production_msg.production_command())
            {
                case jaiabot::protobuf::TEST_IMU_SENSOR:
                //clear any lingering responses before starting IMU test
                clear_all_test_responses();
                imu_reset_complete_ = false;
                imu_reset_pending_ = false; 
                test_pressure_ = false;
                pressure_reset_pending_ = false; 
                pressure_reset_complete_ = false;
                motor_test_running_ = false;
                motor_test_passed_ = false;
                motor_data_received_ = false;
                test_motor_ = false;
                test_imu_ = true;
                break;
                case jaiabot::protobuf::TEST_PRESSURE_SENSOR:  
                //clear any lingering responses before starting pressure test
                clear_all_test_responses();
                imu_reset_complete_ = false;
                imu_reset_pending_ = false;
                test_imu_ = false;
                motor_test_running_ = false;
                motor_test_passed_ = false;
                motor_data_received_ = false;
                test_motor_ = false;
                pressure_reset_complete_ = false;
                pressure_reset_pending_ = false;
                test_pressure_ = true;
                break;
                case jaiabot::protobuf::TEST_MOTOR_HARNESS:
                //clear any lingering responses before starting motor test
                response.clear_pressure_response();
                imu_reset_complete_ = false;
                imu_reset_pending_ = false;
                test_imu_ = false;
                pressure_reset_pending_ = false; 
                pressure_reset_complete_ = false;
                test_pressure_ = false;
                test_motor_ = true;
                motor_test_running_ = false;
                motor_test_passed_ = false;
                motor_data_received_ = false;
                break;
                default:
                glog.is_debug1() && glog << "❓Unknown production command" << std::endl;
                break;
            }
        });
}

void jaiabot::apps::JaiabotProduction::clear_all_test_responses()
{
    response.clear_imu_response();
    response.clear_imu_reset_response();
    response.clear_pressure_response();
    response.clear_motor_response(); 
}


// Checks if IMU data stopped and resumed correctly during the reset window
void jaiabot::apps::JaiabotProduction::imu_sensor_data_timeCheck()
{

    double since_last_imu = seconds_since(last_imu_msg_time_);
    double since_reset = seconds_since(imu_reset_start_time_);

    if (!imu_data_received_)
    {
        glog.is_debug1() && glog << "🛑 IMU Test FAIL: No IMU data has been received yet." << std::endl;
        response.set_imu_response("fail_no_IMU_data_has_been_received_yet");
        return;
    }

    // If we're still in the reset window, wait it out
    if (imu_reset_pending_ && since_reset < cfg().imu_reboot_time())
    {
        glog.is_debug1() && glog << "⏳ Still in IMU reset window, ⏱️ time since last imu message " << since_last_imu << "s)" << std::endl;

        std::ostringstream reset_oss;
        std::ostringstream reset_continued_oss;

        reset_oss << "sent_reset_request_received_no_IMU_data_for_ " << since_last_imu << "s";
        response.set_imu_response(reset_oss.str());

        reset_continued_oss << "IMU_reset_no_IMU_data_for_approx_ " << since_last_imu << "s";
        response.set_imu_reset_response(reset_continued_oss.str());
        return;
    }

    // Normal logic when not in reset mode
    if (since_last_imu > 3.0)
    {
        glog.is_debug1() && glog << "🛑 IMU Test FAIL: No IMU data in over 1 second (" 
                                 << since_last_imu << "s)" << std::endl;

        response.set_imu_response("fail_no_imu_data_after_reset");
    }
    else
    {
        glog.is_debug1() && glog << "✅ IMU Test PASS: IMU data received in " 
                                 << since_last_imu << "s" << std::endl;

        std::ostringstream IMU_oss;
        IMU_oss << "pass_imu_data_received_last_imu_message_sent_ " << since_last_imu << "s";

        response.set_imu_response(IMU_oss.str());
    }

    // Timestamp it
    const auto now = std::chrono::system_clock::now();
    const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
        now.time_since_epoch()).count();
    response.set_time(timestamp_us);
}


// Starts or monitors IMU reset logic depending on current state
void jaiabot::apps::JaiabotProduction::imu_sensor_reset_check()
{
    if (imu_reset_complete_)
        return;  // already done, skip

    double since_last_imu = seconds_since(last_imu_msg_time_);

    if (!imu_reset_pending_)
    {
        imu_reset_pending_ = true;
        imu_reset_start_time_ = goby::time::SystemClock::now();

        glog.is_debug1() && glog << "📡 IMU Test: Starting IMU reset, expecting no IMU data for 2s..." << std::endl;

        if (cfg().is_in_sim())
        {
            glog.is_debug1() && glog << "🧪 In simulation mode — sending IMU dropout command to simulator." << std::endl;

            jaiabot::protobuf::SimulatorCommand command;
            command.mutable_imu_dropout()->set_dropout_duration(cfg().imu_reboot_time());

            glog.is_debug1() && glog << "📤 Sending imu_dropout with duration: "
                                     << cfg().imu_reboot_time() << "s" << std::endl;

            interprocess().publish<jaiabot::groups::simulator_command>(command);
        }
        else
        {
            glog.is_debug1() && glog << "🔧 Not in simulation — calling reboot_bno085_imu() for real IMU reset." << std::endl; 
            reboot_bno085_imu();
        }
        return;
    }

    double since_reset = seconds_since(imu_reset_start_time_);

    if (since_reset > cfg().imu_reboot_time())
    {
        imu_reset_pending_ = false;
        
        // Sets the reset response when reset completes
        if (!imu_reset_complete_)
        {
            std::ostringstream reset_finished_oss;
            reset_finished_oss << "reset_completed_after_" << since_reset << "s";

            response.set_imu_reset_response(reset_finished_oss.str());
        }
        
        // Prevents future calls
        imu_reset_complete_ = true;  
    }
}

//pressure service to be restarted
void jaiabot::apps::JaiabotProduction::pressure_sensor()
{
    if (!pressure_data_received_)
    {
        glog.is_debug1() && glog << "🛑 Pressure Test FAIL: did not receive any pressure data after restart" << std::endl;
        response.set_pressure_response("no_pressure_data_received_after_restart_yet");

        test_pressure_ = false; // Stop the test
        return;
    }
    
    if (!pressure_reset_complete_)
    {
        // Still waiting for reset to complete
        return;
    }

    double since_reset = seconds_since(pressure_reset_start_time_);
    if (latest_pressure_ < 0.2 && since_reset >= 3.0)
    {
        glog.is_debug1() && glog << "💧 Pressure is: " << latest_pressure_ << std::endl;
        glog.is_debug1() && glog << "✅ Pressure Test PASS" << std::endl;

        //response.set_pressure_response("pass_pressure_reading_is_less_than_0.2_after_restart");

        std::ostringstream pressure_pass_oss;
        pressure_pass_oss << "pass_less_then_0.2_latest_pressure_raw: " << latest_pressure_;

        response.set_pressure_response(pressure_pass_oss.str());
        test_pressure_ = false; // Stop the test
    }
    else if(latest_pressure_ >= 0.2 && since_reset >= 3.0)
    {
        glog.is_debug1() && glog << "❌ Pressure Test FAIL: pressure reading >= 0.2 after restart" << std::endl;

        std::ostringstream pressure_fail_oss;
        pressure_fail_oss << "fail_not_less_then_0.2_latest_pressure_raw: " << latest_pressure_;

        response.set_pressure_response(pressure_fail_oss.str());
        test_pressure_ = false; // Stop the test
    }

    // Timestamp it
    const auto now = std::chrono::system_clock::now();
    const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
        now.time_since_epoch()).count();
    response.set_time(timestamp_us);
}

void jaiabot::apps::JaiabotProduction::pressure_sensor_reset_check()
{
    if (pressure_reset_complete_)
        return;

    double since_reset = seconds_since(pressure_reset_start_time_);

    if (!pressure_reset_pending_)
    {
        pressure_reset_pending_ = true;
        pressure_data_resumed_ = false;
        pressure_data_received_ = false;
        pressure_reset_start_time_ = goby::time::SystemClock::now();

        glog.is_debug1() && glog << "📡 Pressure Test: Starting Pressure reset..." << std::endl;

        response.set_pressure_response("restart_request_sent_wait_for_results");
        interprocess().publish<jaiabot::groups::production_response>(response);

        if (cfg().is_in_sim())
        {
            glog.is_debug1() && glog << "🧪 In simulation mode — sending Pressure dropout command to simulator." << std::endl;

            jaiabot::protobuf::SimulatorCommand command;
            command.mutable_pressure_dropout()->set_dropout_duration(cfg().imu_reboot_time());

            glog.is_debug1() && glog << "📤 Sending pressure_dropout with duration: "
                                     << cfg().imu_reboot_time() << "s" << std::endl;

            interprocess().publish<jaiabot::groups::simulator_command>(command);
        }
        else
        {
            glog.is_debug1() && glog << "🔧 Not in simulation — calling restart_pressure_py() for real Pressure reset." << std::endl; 
            restart_pressure_py();
        }

        return;
    }

    // Wait for pressure to resume
    if (!pressure_data_resumed_ && pressure_data_received_)
    {
        pressure_data_resumed_ = true;
        pressure_reset_complete_ = true;

        glog.is_debug1() && glog << "!!Pressure Test: Pressure data resumed after reset!!" << std::endl;
    }

    if (!pressure_data_resumed_ && pressure_data_received_)
    {
        glog.is_debug1() && glog << "⏳ Waiting for pressure data to resume after reset ("
                                 << since_reset << "s elapsed)..." << std::endl;

        std::ostringstream oss;
        oss << "waiting_for_pressure_data_post_restart_" << since_reset << "s";

        response.set_pressure_response(oss.str());
        interprocess().publish<jaiabot::groups::production_response>(response);
    }
}

void jaiabot::apps::JaiabotProduction::motor_harness()
{
    if (!motor_test_running_)
    {
        motor_test_running_ = true;
        motor_command_sent_ = false; // <-- Add this if not already in your class
        motor_test_start_time_ = goby::time::SystemClock::now();

        // Reset motor test data at start
        motor_data_received_ = false;
        latest_rpm_ = 0.0;
        latest_temperature_ = 0.0;

        glog.is_debug1() && glog << "Motor Harness Test: Starting 2s motor run..." << std::endl;
        response.set_motor_response("motor_test_started_running_for_2s");

        return;
    }

    double elapsed = seconds_since(motor_test_start_time_);

    if (elapsed < 2.1)
    {
        if (!motor_command_sent_)
        {
            glog.is_debug1() && glog << "➡️ Publishing motor DesiredSetpoints (POWERED_ASCENT with max throttle)" << std::endl;

            jaiabot::protobuf::DesiredSetpoints setpoint;
            setpoint.set_type(jaiabot::protobuf::SETPOINT_POWERED_ASCENT);
            setpoint.set_throttle(37.5);  // High throttle for maximum RPM (range is -100 to 100)

            interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint);
            motor_command_sent_ = true;
        }

        std::ostringstream motor_running_oss;
        motor_running_oss << "motor_test_running_elapsed_time_" << elapsed << "s";

        response.set_motor_response(motor_running_oss.str());
        return;
    }

    // Send stop command after test duration
    if (elapsed >= 2.1 && motor_command_sent_)
    {
        glog.is_debug1() && glog << "🛑 Stopping motor after test completion" << std::endl;
        
        jaiabot::protobuf::DesiredSetpoints stop_setpoint;
        stop_setpoint.set_type(jaiabot::protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(stop_setpoint);
        
        motor_command_sent_ = false; // Prevent repeated stop commands
    }

    // Test completed, check results
    if (!motor_data_received_)
    {
        glog.is_debug1() && glog << "🛑 Motor Test FAIL: did not receive any motor data" << std::endl;
        response.set_motor_response("fail_no_motor_data_received");

        test_motor_ = false;
        motor_test_running_ = false;
        return;
    }

    bool rpm_ok = latest_rpm_ >= 3600;
    bool temp_ok = latest_temperature_ >= 10 && latest_temperature_ <= 30;

    // Also check IMU reset during motor test
    imu_sensor_reset_check();
    imu_sensor_data_timeCheck();

    if (rpm_ok && temp_ok && imu_reset_complete_)
    {
        glog.is_debug1() && glog << "✅ Motor Harness Test PASS" << std::endl;

        std::ostringstream motor_pass_oss;
        motor_pass_oss << "pass_rpm_" << latest_rpm_ << "_temp_" << latest_temperature_ << "_imu_reset_completed";

        response.set_motor_response(motor_pass_oss.str());
        test_motor_ = false;
        motor_test_running_ = false;

    }
    else
    {
        std::string reason = "fail_";
        if (!rpm_ok) reason += "rpm_" + std::to_string(latest_rpm_) + "_less_than_3600_";
        if (!temp_ok) reason += "temp_" + std::to_string(latest_temperature_) + "_not_in_range_10_30_";
        if (!imu_reset_complete_) reason += "imu_reset_not_completed_";

        glog.is_debug1() && glog << "❌ Motor Harness Test FAIL: " << reason << std::endl;
        response.set_motor_response(reason);
        test_motor_ = false;
        motor_test_running_ = false;
    }

    // Timestamp it
    const auto now = std::chrono::system_clock::now();
    const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
        now.time_since_epoch()).count();
    response.set_time(timestamp_us);
}

void jaiabot::apps::JaiabotProduction::loop()
{
    // Ensure IMU test logic runs while test_imu_ is true OR during reset
    if (test_imu_ || imu_reset_pending_)
    {
        imu_sensor_data_timeCheck();
        imu_sensor_reset_check();
        
        interprocess().publish<jaiabot::groups::production_response>(response);
    }

    // Ensure Pressure Sensor test logic runs while test_pressure_ is true
    if (test_pressure_ || pressure_reset_pending_)
    {
        pressure_sensor();
        pressure_sensor_reset_check();

        interprocess().publish<jaiabot::groups::production_response>(response);
    }


    if(test_motor_ || motor_test_running_)
    {
        motor_harness();
        imu_sensor_data_timeCheck();
        imu_sensor_reset_check();

        interprocess().publish<jaiabot::groups::production_response>(response);
    }
    
}
