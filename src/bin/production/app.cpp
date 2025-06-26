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
#include <google/protobuf/text_format.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>
#include <goby/middleware/application/interface.h>
#include <goby/middleware/application/tool.h>
#include <fstream>
#include "config.pb.h"
#include "jaiabot/groups.h"
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
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

        bool imu_reset_pending_ = false;
        goby::time::SystemClock::time_point imu_reset_start_time_;
        goby::time::SystemClock::time_point last_imu_msg_time_;
        bool imu_data_received_ = false;
        bool pressure_data_received_ = false;
        bool imu_data_paused_ = false;

        void restart_imu_py() { system("systemctl restart jaiabot_imu_py"); }

        goby::time::SteadyClock::time_point last_imu_issue_report_time_{std::chrono::seconds(0)};


        bool motor_test_running_ = false;
        void imu_sensor();
        void pressure_sensor();
        void motor_harness();

        goby::time::SystemClock::time_point motor_test_start_time_;

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

jaiabot::apps::JaiabotProduction::JaiabotProduction() : ApplicationBase()
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
                }
            }
        });
        // ??? double subscribe why
    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const jaiabot::protobuf::IMUIssue& imu_issue){
            switch(imu_issue.solution()){
                case protobuf::IMUIssue::RESTART_IMU_PY:
                    glog.is_debug2() && glog << "IMU ERROR: RESTART IMU PY. " << std::endl;
                    restart_imu_py();
                    break;
                default:
                    break;
            }
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

   interprocess().subscribe<jaiabot::groups::production>(
    [this](const jaiabot::protobuf::ProductionRequest& production_msg)
    {
        jaiabot::protobuf::ProductionResponse response;

        // Set raw timestamp
        const auto now = std::chrono::system_clock::now();
        const auto timestamp_us = std::chrono::duration_cast<std::chrono::microseconds>(
            now.time_since_epoch()).count();
        response.set_time(timestamp_us);

        // Set readable_time string
        std::time_t now_time = std::chrono::system_clock::to_time_t(now);
        std::tm* local_tm = std::localtime(&now_time);
        std::ostringstream time_stream;
        time_stream << std::put_time(local_tm, "%Y-%m-%d %H:%M:%S");
        response.set_readable_time(time_stream.str()); 

        // Set production command in response
        response.set_production_command(production_msg.production_command());

        switch (production_msg.production_command())
        {
            case jaiabot::protobuf::TEST_IMU_SENSOR:
                imu_sensor();
                break;
            case jaiabot::protobuf::TEST_PRESSURE_SENSOR:
                pressure_sensor();
                break;
            case jaiabot::protobuf::TEST_MOTOR_HARNESS:
                motor_harness();
                break;
            default:
                glog.is_debug1() && glog << "❓Unknown production command" << std::endl;
                break;
        }

        // When done production app responds
        interprocess().publish<jaiabot::groups::production>(response);  // Publishes where Scope listens
    });
}

//when reset imu service is started, imu data stops sending for 2 seconds
void jaiabot::apps::JaiabotProduction::imu_sensor()
{
    // 1. Confirm we are receiving IMU data
    if (!imu_data_received_)
    {
        glog.is_debug1() && glog << "🛑 IMU Test FAIL: did not receive any IMU data" << std::endl;
        return;
    }
    else
    {
        glog.is_debug1() && glog << "✅ IMU Test Pass: we are receiving IMU data" << std::endl;
    }

    // 2. When reset is started, check for 2s pause in IMU data
    if (!imu_reset_pending_)
    {
        // Start reset
        imu_reset_pending_ = true;
        imu_data_paused_ = false;
        imu_reset_start_time_ = goby::time::SystemClock::now();
        glog.is_debug1() && glog << "📡 IMU Test: Starting IMU reset, expecting no IMU data for 2s..." << std::endl;
        //trigger the actual IMU reset service
        restart_imu_py();
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
                glog.is_debug1() && glog << "✅ IMU Test PASS: IMU data paused for 2 seconds after reset" << std::endl;
            }
            else
            {
                glog.is_debug1() && glog << "❌ IMU Test FAIL: IMU data was not paused for 2 seconds after reset" << std::endl;
            }
            imu_reset_pending_ = false;
        }
    }
}

//pressure service to be restarted
void jaiabot::apps::JaiabotProduction::pressure_sensor()
{
    // Test 2: Pressure service is restarted and pressure reading < 0.2
    if (!pressure_data_received_)
    {
        glog.is_debug1() && glog << "🛑 Pressure Test FAIL: did not receive any pressure data" << std::endl;
        return;
    }
    if (pressure_test_passed_)
    {
        glog.is_debug1() && glog << "💧 Pressure is: " << latest_pressure_ << std::endl;
        glog.is_debug1() && glog << "✅ Pressure Test PASS" << std::endl;
    }
    else
    {
        glog.is_debug1() && glog << "💧 Pressure is: " << latest_pressure_ << std::endl;
        glog.is_debug1() && glog << "❌ Pressure Test FAIL: did not pass test, pressure reading >= 0.2" << std::endl;
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
        glog.is_debug1() && glog << "Motor Harness Test: Starting 2s motor run..." << std::endl;
        //restart_imu_py(); If we want to reset IMU at start of motor test
        return;
    }
    double elapsed = seconds_since(motor_test_start_time_);
    if (elapsed < 2.0)
    {
        // Still running test
        return;
    }

    bool rpm_ok = latest_rpm_ >= 3600;
    bool temp_ok = latest_temperature_ >= 10 && latest_temperature_ <= 30;

    // Optionally: check for IMU pause here if you want to enforce the IMU reset/pause as part of this test

    if (rpm_ok && temp_ok)
    {
        glog.is_debug1() && glog << "✅ Motor Harness Test PASS" << std::endl;
        motor_test_passed_ = true;
    }
    else
    {
        std::string reason;
        if (!rpm_ok)
            reason += "rpm < 3600; ";
        if (!temp_ok)
            reason += "temperature not in [10,30]; ";
        glog.is_debug1() && glog << "❌ Motor Harness Test FAIL: did not pass test, " << reason << std::endl;
        motor_test_passed_ = false;
    }
    motor_test_running_ = false;
}