// Copyright 2022:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
//
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


//imu data, pressure, motor status, production

//test imuSensor - test is to confirm we are receiving imu data; when reset imu servie is started
// imu data stops sending for 2 secs
//pressureSensor - pressure service is restarted and the pressure reading < 0.2
//motorHarness - run motor for 2secs and confirm rpm >= 3600
//get temperature data - temp data between 10-30; reset imu service pauses imu data for 2 secs
using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::JaiabotProduction>;
using namespace std;

namespace jaiabot
{
namespace apps
{
namespace groups
{

}

class JaiabotProduction: public ApplicationBase
{
    public:
        JaiabotProduction();

    private:
        
        /*bool imu_test_passed_ = false;
        bool pressure_test_passed_ = false;
        bool motor_test_passed_ = false;

        double latest_pressure_ = 0.0;
        double latest_rpm_ = 0.0;
        double latest_temperature_ = 0.0;

        bool imu_reset_pending_ = false;
        goby::time::SystemClock::time_point imu_reset_start_time_;
    
        void loop() override;
        void imu_sensor();
        void pressure_sensor();
        void motor_harness();*/
    
};
} //namespace apps
} //namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::JaiabotProduction>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::JaiabotProduction>(argc, argv));
}

jaiabot::apps::JaiabotProduction::JaiabotProduction() : ApplicationBase(0.5 * si::hertz)
{
    glog.is_debug1() && glog << "Production App" << std::endl;

    //test imuSensor - test is to confirm we are receiving imu data; when reset imu service is started
    // imu data stops sending for 2 secs
    /*interprocess().subscribe<jaiabot::groups::imu>(
    [this](const protobuf::ImuData& msg)
    {
        // Process IMU data here
    });

    //pressureSensor - pressure service is restarted and the pressure reading < 0.2
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
    [this](const protobuf::PressureTemperatureData& msg)
    {
        latest_pressure_ = msg.pressure();
        if (latest_pressure_ < 0.2) pressure_test_passed_ = true;
    });


    //motorHarness - run motor for 2secs and confirm rpm >= 3600
    //get temperature data - temp data between 10-30; reset imu service pauses imu data for 2 secs
    interprocess().subscribe<jaiabot::groups::motor_status>(
    [this](const protobuf::Motor& msg)
    {
        latest_rpm_ = msg.rpm();
        if (latest_rpm_ >= 3600) motor_test_passed_ = true;
    });

*/
} //ApplicationBase JaiabotProduction


/*Response: PASS or FAIL If it FAILs then give a message why: did not pass test ... 
void jaiabot::apps::JaiabotProduction::imu_sensor()
{
    //check if data is paused after reset or validate the data

}

//Response: PASS or FAIL If it FAILs then give a message why: did not pass test
void jaiabot::apps::JaiabotProduction::pressure_sensor()
{
    
}

//Response: PASS or FAIL If it FAILs then give a message why: did not pass test
void jaiabot::apps::JaiabotProduction::motor_harness()
{
    
}

//debug function
void jaiabot::apps::JaiabotProduction::loop()
{
    if (imu_test_passed_ && pressure_test_passed_ && motor_test_passed_)
    {
        glog.is_debug1() && glog << "All tests passed!!!" << std::endl;
    }
}

*/