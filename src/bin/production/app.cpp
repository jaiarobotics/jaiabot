// Copyright 2022:
//   JaiaRobotics LLC
// File authors:
//   Kanz Giwa
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
#include <google/protobuf/text_format.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>
#include <goby/middleware/application/interface.h>
#include <goby/middleware/application/tool.h>
#include <fstream>
#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/motor.pb.h"
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "jaiabot/messages/production.pb.h"

//imu data, pressure, motor status, production

//test imuSensor - test is to confirm we are receiving imu data; when reset imu servie is started
// imu data stops sending for 2 secs
//pressureSensor - pressure service is restarted and the pressure reading < 0.2
//motorHarness - run motor for 2secs and confirm rpm >= 3600
//get temperature data - temp data between 10-30; reset imu service pauses imu data for 2 secs
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
        // Test state
        bool imu_test_passed_ = false;
        bool pressure_test_passed_ = false;
        bool motor_test_passed_ = false;

        double latest_pressure_ = 100.0;
        double latest_rpm_ = 0.0;
        double latest_temperature_ = 0.0;
        double pressure_restart_duration_sec_ = 0.0;

        bool imu_reset_pending_ = false;
        goby::time::SystemClock::time_point imu_reset_start_time_;
        goby::time::SystemClock::time_point last_imu_msg_time_;
        bool imu_data_received_ = false;
        bool pressure_data_received_ = false;
        bool imu_data_paused_ = false;
        bool pressure_restart_pending_ = false;

        bool motor_test_running_ = false;
        goby::time::SystemClock::time_point pressure_restart_time_;
        goby::time::SystemClock::time_point motor_test_start_time_;

        void imu_sensor();
        void pressure_sensor();
        void motor_harness();

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

            if (imu_msg.has_euler_angles() && imu_msg.euler_angles().has_heading())
            {
                double heading = imu_msg.euler_angles().heading();
                if (heading >= 0 && heading <= 360)
                {
                    imu_test_passed_ = true;
                    interprocess().publish<jaiabot::groups::imu>(imu_msg);

                }
            }
        });


    // Subscribe to pressure sensor data
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
    [this](const jaiabot::protobuf::PressureTemperatureData& pt)
    {
        // If restart is pending, check if enough time has passed before resuming
        if (pressure_restart_pending_)
        {
            double elapsed = seconds_since(pressure_restart_time_);
            if (elapsed < pressure_restart_duration_sec_)
            {
                glog.is_debug1() && glog << "⏸️ Pressure data ignored (restart in progress)... "
                                         << elapsed << "s elapsed of "
                                         << pressure_restart_duration_sec_ << "s" << std::endl;
                return; // Ignore this message
            }
            else
            {
                glog.is_debug1() && glog << "▶️ Pressure restart window complete. Accepting data now." << std::endl;
                pressure_restart_pending_ = false; // Done waiting
            }
        }

        pressure_data_received_ = true;
        latest_pressure_ = pt.pressure_raw();

        if (latest_pressure_ < 0.2)
        {
            pressure_test_passed_ = true;
            interprocess().publish<jaiabot::groups::pressure_temperature>(pt);
        }
    });


    // Subscribe to motor status
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
                    interprocess().publish<jaiabot::groups::motor_status>(motor_msg);
                }
            }
        });

    interprocess().subscribe<jaiabot::groups::production>(
        [this](const jaiabot::protobuf::ProductionRequest& production_msg)
        {
            glog.is_debug1() && glog << "🟢 Received ProductionRequest, time = "
                                     << production_msg.time()
                                     << std::endl;

            switch (production_msg.production_command())
            {
                case jaiabot::protobuf::TEST_IMU_SENSOR:
                {
                    imu_reset_pending_ = true;
                    imu_test_passed_ = false;
                    imu_data_received_ = false;
                    imu_data_paused_ = false;
                    imu_reset_start_time_ = goby::time::SystemClock::now();

                    glog.is_debug1() && glog << "🔁 IMU reset triggered for IMU test!" << std::endl;
                    break;
                }
                case jaiabot::protobuf::TEST_PRESSURE_SENSOR:
                {
                    pressure_restart_pending_ = true;
                    pressure_test_passed_ = false;
                    pressure_data_received_ = false;
                    pressure_restart_time_ = goby::time::SystemClock::now();

                    glog.is_debug1() && glog << "🔁 Pressure sensor restart triggered!" << std::endl;
                    break;
                }
                case jaiabot::protobuf::TEST_MOTOR_HARNESS:
                {
                    motor_test_running_ = true;
                    motor_test_passed_ = false;
                    motor_test_start_time_ = goby::time::SystemClock::now();

                    // Also reset IMU for this test
                    imu_reset_pending_ = true;
                    imu_test_passed_ = false;
                    imu_data_received_ = false;
                    imu_data_paused_ = false;
                    imu_reset_start_time_ = goby::time::SystemClock::now();

                    glog.is_debug1() && glog << "🔁 Motor harness test triggered (and IMU reset)!" << std::endl;
                    break;
                }
                default:
                    break;
            }

            interprocess().publish<jaiabot::groups::production_request>(production_msg);
        });

}

void jaiabot::apps::JaiabotProduction::imu_sensor()
{
    // Test 1: IMU data received, and after reset, data pauses for 2 seconds
    if (!imu_data_received_)
    {
        //glog.is_debug1() && glog << "🛑 IMU Test FAIL: did not receive any IMU data" << std::endl;
        return;
    }

    // Simulate sending reset and checking for 2s pause
    if (!imu_reset_pending_)
    {
        // Start reset
        imu_reset_pending_ = true;
        imu_data_paused_ = false;
        imu_reset_start_time_ = goby::time::SystemClock::now();
        //glog.is_debug1() && glog << "📡 IMU Test: Starting IMU reset, expecting no IMU data for 2s..." << std::endl;
    }
    else
    {
        double since_reset = seconds_since(imu_reset_start_time_);
        double since_last_imu = seconds_since(last_imu_msg_time_);
        if (since_reset > 2.0)
        {
            if (since_last_imu >= 2.0)
            {
                imu_data_paused_ = true;
                //glog.is_debug1() && glog << "🎉 IMU Test PASS" << std::endl;
            }
            else
            {
                //glog.is_debug1() && glog << "😵 IMU Test FAIL: IMU data was not paused for 2 seconds after reset" << std::endl;
            }
            imu_reset_pending_ = false;
        }
    }
}

void jaiabot::apps::JaiabotProduction::pressure_sensor()
{
    // Test 2: Pressure reading < 0.2 after restart
    if(!pressure_data_received_){
        glog.is_debug1() && glog << "Pressure Test FAIL: did not receive any pressure data" << std::endl; //(commented for testing reasons will uncomment later )
    } else if (pressure_test_passed_ && pressure_data_received_){
        glog.is_debug1() && glog << "Pressure is: " << latest_pressure_ <<std::endl;
        glog.is_debug1() && glog << "Pressure Test PASS" << std::endl;
    }else if(!pressure_test_passed_ && pressure_data_received_){
        glog.is_debug1() && glog << "Pressure is: " << latest_pressure_ <<std::endl;
        glog.is_debug1() && glog << "Pressure Test FAIL: did not pass test, pressure reading >= 0.2" << std::endl;
    }
}
    
void jaiabot::apps::JaiabotProduction::motor_harness()
{
    // Test 3: Run motor for 2s, confirm rpm >= 3600, temperature 10-30, and IMU data pauses for 2s
    if (!motor_test_running_)
    {
        motor_test_running_ = true;
        motor_test_passed_ = false;
        motor_test_start_time_ = goby::time::SystemClock::now();
        //glog.is_debug1() && glog << "Motor Harness Test: Starting 2s motor run..." << std::endl;
        return;
    }
    double elapsed = seconds_since(motor_test_start_time_);
    if (elapsed < 2.0)
    {
        // Still running test
        return;
    }
    if (motor_test_passed_)
    {
        //glog.is_debug1() && glog << "Motor Harness Test PASS" << std::endl;
    }
    else
    {
        std::string reason;
        if (latest_rpm_ < 3600)
            reason += "rpm < 3600; ";
        if (latest_temperature_ < 10 || latest_temperature_ > 30)
            reason += "temperature not in [10,30]; ";
        //glog.is_debug1() && glog << "Motor Harness Test FAIL: did not pass test, " << reason << std::endl;
    }
    motor_test_running_ = false;
}

void jaiabot::apps::JaiabotProduction::loop()
{
    // Calls test functions on every loop tick (e.g., every 0.2 seconds)
    imu_sensor();
    // Delay pressure test until restart wait is over
if (pressure_restart_pending_)
{
    double elapsed = seconds_since(pressure_restart_time_);
    if (elapsed < pressure_restart_duration_sec_)
    {
        return; // Still waiting, skip the test
    }
}

    pressure_sensor();
    motor_harness();
}