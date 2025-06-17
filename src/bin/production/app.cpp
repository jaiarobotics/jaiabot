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
        ~JaiabotProduction();

    private:
        void loop() override;
    
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


} //ApplicationBase JaiabotProduction

void jaiabot::apps::JaiabotProduction::intervehicle_subscribe(
    const jaiabot::protobuf::HubInfo& hub_info)
{


}

jaiabot::apps::JaiabotProduction::~JaiabotProduction()
{


}

void jaiabot::apps::JaiabotProduction::loop()
{



}

/*
constexpr int thermistor_ohms_neutral = 10000;
constexpr int thermistor_voltage = 5;

jaiabot::apps::MotorStatusThread::MotorStatusThread(
    const jaiabot::config::MotorStatusConfig& cfg)
    : HealthMonitorThread(cfg, "motor_status", 5.0 * boost::units::si::hertz)
{
    status_.set_motor_harness_type(cfg.motor_harness_type());

    interthread().subscribe<jaiabot::groups::motor_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        jaiabot::protobuf::Motor motor;
        if (!motor.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize Motor message from UDP packet"
                                   << std::endl;
            return;
        }
        glog.is_debug2() && glog << "Publishing Motor message: " << motor.ShortDebugString()
                                 << std::endl;

        rpm_value_ = motor.rpm();        
        last_motor_rpm_report_time_ = goby::time::SteadyClock::now();
    });

    interprocess().subscribe<jaiabot::groups::arduino_to_pi>(
        [this](const jaiabot::protobuf::ArduinoResponse& arduino_response) {
            if (arduino_response.has_thermistor_voltage())
            {
                float voltage = arduino_response.thermistor_voltage();
                float resistance = thermistor_ohms_neutral * voltage / (thermistor_voltage - voltage);
                float temperature =
                    goby::util::linear_interpolate(resistance, resistance_to_temperature_);
                float temperature_celsius = (temperature - 32) / 1.8;

                status_.mutable_thermistor()->set_temperature(temperature_celsius);
                status_.mutable_thermistor()->set_resistance(resistance);
                status_.mutable_thermistor()->set_voltage(voltage);

                last_motor_thermistor_report_time_ = goby::time::SteadyClock::now();
            }

            if (arduino_response.has_motor())
            {
                if (arduino_response.motor() > 1500)
                {
                    // motor is spinning in forward direction
                    status_.set_rpm(std::abs(rpm_value_));
                }
                else if (arduino_response.motor() < 1500)
                {
                    // motor is spinning in reverse direction
                    status_.set_rpm(-std::abs(rpm_value_));
                }
                else
                {
                    // motor is off
                    status_.set_rpm(0);
                }
            }
        });
}

void jaiabot::apps::MotorStatusThread::issue_status_summary()
{
    send_rpm_query();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::motor_status>(status_);
}
*/
