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
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "jaiabot/messages/production.pb.h"
#include "jaiabot/messages/simulator.pb.h"

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

        // restart and reboot imu
        void restart_imu_py() { system("systemctl restart jaiabot_imu_py"); }
        void reboot_bno085_imu() { system("systemctl start jaia_firm_bno085_reset_gpio_pin_py"); }

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

        //restart pressure
        void restart_pressure_py() { system("systemctl restart jaiabot_pressure_py"); }



        // Motor Test State
        /*
        bool motor_test_passed_ = false;
        bool motor_data_received_ = false;
        bool motor_test_running_ = false;
        double latest_rpm_ = 0.0;
        double latest_temperature_ = 0.0;
        bool motor_test_running_ = false;
        goby::time::SystemClock::time_point motor_test_start_time_;

        void motor_harness();
        
        bool test_motor_ = false;
        */
        
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
            if (latest_pressure_ < 0.2)
            {
                pressure_test_passed_ = true;
            }

        });

    // Subscribe to motor status
    /*
    interprocess().subscribe<jaiabot::groups::motor_status>(
        [this](const jaiabot::protobuf::Motor& motor_msg)
        {
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
        */

       // Subscribe to production
       interprocess().subscribe<jaiabot::groups::production>(
           [this](const jaiabot::protobuf::ProductionRequest& production_msg)
           {
        // Set raw timestamp
        const auto now = std::chrono::system_clock::now();
        const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
            now.time_since_epoch()).count();
        response.set_time(timestamp_us);
        
        // Set production command in response
        response.set_production_command(production_msg.production_command());
        
        //clear any lingering responses afrer a switch
        clear_all_test_responses();
        
        switch (production_msg.production_command())
        {
            case jaiabot::protobuf::TEST_IMU_SENSOR:
            imu_reset_complete_ = false; 
            test_pressure_ = false;
            test_imu_ = true;
            break;
            case jaiabot::protobuf::TEST_PRESSURE_SENSOR:  
            pressure_reset_complete_ = false;
            pressure_reset_pending_ = false;
            test_imu_ = false;
            test_pressure_ = true;
            pressure_sensor_reset_check();
            pressure_sensor();
            break;
            case jaiabot::protobuf::TEST_MOTOR_HARNESS:
            //test_motor_ = true;
            break;
            default:
            glog.is_debug1() && glog << "❓Unknown production command" << std::endl;
            break;
        }
        
        // When done production app responds
        interprocess().publish<jaiabot::groups::production>(response);  // Publishes where Scope listens
    });
}

// Function that clears any lingering responses afrer a switch
void jaiabot::apps::JaiabotProduction::clear_all_test_responses()
{
    response.clear_imu_response();
    response.clear_imu_reset_response();
    response.clear_pressure_response();
    // response.clear_motor_response(); // Uncomment when motor response is added
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
        std::ostringstream reset_finished_oss;
        reset_oss << "sent_reset_request_received_no_IMU_data_for_ " << since_last_imu << "s";
        response.set_imu_response(reset_oss.str());
        reset_finished_oss << "reset_finished_no_IMU_data_for_approx_ " << since_last_imu << "s";
        response.set_imu_reset_response(reset_finished_oss.str());
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
        response.set_pressure_response("fail_no_pressure_data_received_after_restart");
    }

    if (latest_pressure_ < 0.2)
    {
        glog.is_debug1() && glog << "💧 Pressure is: " << latest_pressure_ << std::endl;
        glog.is_debug1() && glog << "✅ Pressure Test PASS" << std::endl;
        response.set_pressure_response("pass_pressure_reading_is_less_than_0.2_after_restart");
    }
    else
    {
        glog.is_debug1() && glog << "❌ Pressure Test FAIL: pressure reading >= 0.2 after restart" << std::endl;
        response.set_pressure_response("fail_pressure_reading_is_greater_than_or_equal_to_0.2_after_restart");
    }
}

void jaiabot::apps::JaiabotProduction::pressure_sensor_reset_check()
{
    if(pressure_reset_complete_) return;

    if(!pressure_reset_pending_)
    {
        pressure_reset_pending_ = true;

        glog.is_debug1() && glog << "📡 Pressure Test: Starting Pressure reset..." << std::endl;

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

}


/*
void jaiabot::apps::JaiabotProduction::motor_harness()
{
    // Test 3: Run motor for 2s, confirm rpm >= 3600, temperature 10-30, and IMU data pauses for 2s

    response.set_production_command(jaiabot::protobuf::TEST_MOTOR_HARNESS);

    double since_reset = seconds_since(imu_reset_start_time_);
    double elapsed = seconds_since(motor_test_start_time_);

    if (elapsed < 2.0)
    {
        // Still running test
        return;
    }

    bool rpm_ok = latest_rpm_ >= 3600;
    bool temp_ok = latest_temperature_ >= 10 && latest_temperature_ <= 30;

    if(!motor_data_received_)
    {
        glog.is_debug1() && glog << "🛑 Motor Test FAIL: did not receive any motor data" << std::endl;
        response.set_test_result("FAIL");
        response.set_response("No Motor data has been received yet");
        return;
    }

    /*imu_sensor_data_timeCheck();
    imu_sensor_reset_check();

    if (!motor_test_running_)
    {
        motor_test_running_ = true;
        motor_test_start_time_ = goby::time::SystemClock::now();
        glog.is_debug1() && glog << "Motor Harness Test: Starting 2s motor run..." << std::endl;
        return;
    }

    if (rpm_ok && temp_ok)
    {
        glog.is_debug1() && glog << "✅ Motor Harness Test PASS" << std::endl;
        response.set_test_result("PASS");
        response.set_response("RPM >= 3600 and Temperature between 10-30");
        imu_reset_pending_ = false;
        imu_reset_complete_ = true;
    }
    else
    {
        std::string reason;
        if (!rpm_ok) reason += "rpm < 3600 ";
        if (!temp_ok) reason += "temp not in [10,30] ";

        glog.is_debug1() && glog << "❌ Motor Harness Test FAIL: " << reason << std::endl;

        response.set_test_result("FAIL");
        response.set_response(reason);
        motor_test_passed_ = false;
    }

    motor_test_running_ = false;
    imu_reset_pending_ = false;
    imu_reset_complete_ = false;

    // Timestamp it
    const auto now = std::chrono::system_clock::now();
    const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
        now.time_since_epoch()).count();
    response.set_time(timestamp_us);
}
*/

/*
void jaiabot::apps::JaiabotProduction::check_imu()
{
    if (test_imu_ || imu_reset_pending_)
    {
        imu_sensor_reset_check();
        imu_sensor_data_timeCheck();

        if (imu_reset_complete_)
        {
            interprocess().publish<jaiabot::groups::production>(response);
        }
    }
}
*/


void jaiabot::apps::JaiabotProduction::loop()
{
    // Ensure IMU test logic runs while test_imu_ or imu_reset_pending_ is true
    if (test_imu_ || imu_reset_pending_)
    {
        imu_sensor_data_timeCheck();
        imu_sensor_reset_check();
        interprocess().publish<jaiabot::groups::production>(response);
    
    }

    // Ensure Pressure Sensor test logic runs while test_pressure_ or pressure_reset_pending_ is true
    
    /*
    if (test_pressure_ || pressure_reset_pending_)
    {
        pressure_sensor();
        pressure_sensor_reset_check();

        if (pressure_reset_complete_)
        {
            interprocess().publish<jaiabot::groups::production>(response);
        }

    }
        */

    /*
    if(test_motor_)
    {
        motor_harness();
        check_imu();

    }*/
        
}
