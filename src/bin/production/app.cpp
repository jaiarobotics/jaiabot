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
#include <google/protobuf/text_format.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>
#include <goby/middleware/application/interface.h>
#include <goby/middleware/application/tool.h>
#include "jaiabot/messages/motor.pb.h"
#include <fstream>
#include "config.pb.h"
#include "jaiabot/health/health.h"
#include "jaiabot/messages/mission.pb.h"
#include "jaiabot/messages/motor.pb.h"
#include "jaiabot/comms/comms.h"
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/intervehicle.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/modem_message_extensions.pb.h"

//imu data, pressure, motor status, production

//test imuSensor, pressureSensor, motorHarness
//get temperature data
using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::JaiabotEngineering>;

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
    
        // timeout in seconds
        int course_over_ground_timeout_{0};
        double previous_course_over_ground_{0};

        // IMU Detection vars
        bool imu_issue_detected_{false};
        int imu_issue_crs_hdg_incr_{0};
        double bot_desired_speed_{0};
        double bot_desired_heading_{0};
        goby::time::SteadyClock::time_point last_imu_detect_time_{std::chrono::seconds(0)};
        std::set<jaiabot::protobuf::MissionState> include_imu_detection_states_;
        goby::time::SteadyClock::time_point last_imu_issue_report_time_{std::chrono::seconds(0)};
        int pitch_angle_check_incr_{0};
        goby::time::MicroTime last_pitch_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
        bool is_bot_horizontal_{false};

        // Milliseconds
        int bot_status_period_ms_{1000};
        bool rf_disabled_{false};
        int rf_disabled_timeout_mins_{10};
        goby::time::SteadyClock::time_point last_bot_status_report_time_{std::chrono::seconds(0)};

        enum class DataType
        {
            PRESSURE,
            TEMPERATURE,
            SPEED
        }
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


} //ApplicationBase JaiabotProduction

void jaiabot::apps::JaiabotProduction::intervehicle_subscribe(
    const jaiabot::protobuf::HubInfo& hub_info)
{



}

jaiabot::apps::Health::Health()
    : ApplicationBase(1.0 * boost::units::si::hertz),
      next_check_time_(goby::time::SteadyClock::now() +
                       goby::time::convert_duration<goby::time::SteadyClock::duration>(
                           cfg().auto_restart_init_grace_period_with_units())),
      process_to_not_responding_error_(create_process_to_not_responding_error_map())
{
    using MotorRPMUDPThread = goby::middleware::io::UDPPointToPointThread<jaiabot::groups::motor_udp_in, jaiabot::groups::motor_udp_out>;

    //might be important for testing the IMU sensor
    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const jaiabot::protobuf::IMUIssue& imu_issue) {
            glog.is_debug2() && glog << "Received IMU Issue " << imu_issue.ShortDebugString()
                                     << std::endl;

            switch (imu_issue.solution())
            {
                case protobuf::IMUIssue::STOP_BOT: break;
                case protobuf::IMUIssue::RESTART_IMU_PY:
                    if (!cfg().is_in_sim() || cfg().test_hardware_in_sim())
                    {
                        glog.is_debug2() && glog << "IMU ERROR: RESTART IMU PY. " << std::endl;
                        restart_imu_py();
                    }
                    else
                    {
                        glog.is_debug2() && glog << "IMU ERROR: IGNORING IN SIM" << std::endl;
                    }
                    break;
                case protobuf::IMUIssue::REBOOT_BOT: break;
                case protobuf::IMUIssue::USE_COG: break;
                case protobuf::IMUIssue::USE_CORRECTION: break;
                case protobuf::IMUIssue::REPORT_IMU: break;
                case protobuf::IMUIssue::RESTART_BOT: break;
                case protobuf::IMUIssue::REBOOT_BNO085_IMU:
                    if (!cfg().is_in_sim() || cfg().test_hardware_in_sim())
                    {
                        glog.is_debug2() && glog << "IMU ERROR: REBOOT IMU" << std::endl;
                        reboot_bno085_imu();
                    }
                    else
                    {
                        glog.is_debug2() && glog << "IMU ERROR: IGNORING IN SIM" << std::endl;
                    }
                    break;
                case protobuf::IMUIssue::REBOOT_BNO085_IMU_AND_RESTART_IMU_PY:
                    if (!cfg().is_in_sim() || cfg().test_hardware_in_sim())
                    {
                        glog.is_debug2() && glog << "IMU ERROR: REBOOT IMU and RESTART IMU PY. "
                                                 << std::endl;
                        reboot_bno085_imu();
                        restart_imu_py();
                    }
                    else
                    {
                        glog.is_debug2() && glog << "IMU ERROR: IGNORING IN SIM" << std::endl;
                    }

                    break;
                default:
                    //TODO Handle Default Case
                    break;
            }
        });
    if (!cfg().is_in_sim() || cfg().test_hardware_in_sim())
    {
        launch_thread<LinuxHardwareThread>(cfg().linux_hw());
        launch_thread<NTPStatusThread>(cfg().ntp());

        if (cfg().motor().motor_harness_type() != jaiabot::protobuf::MotorHarnessType::NONE)
        {
            launch_thread<MotorRPMUDPThread>(cfg().udp_config());
            launch_thread<MotorStatusThread>(cfg().motor());
        }
    }

    //might need this for a test case if app is not working
    for (auto error : failed_services_)
        last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_error(error);

    for (const auto& proc : vehicle_health.process())
    {
        if (proc.main().has_error() &&
            proc.main().error() == goby::middleware::protobuf::ERROR__PROCESS_DIED)
        {
            auto it =
                process_to_not_responding_error_.find(boost::to_lower_copy(proc.main().name()));
            if (it != process_to_not_responding_error_.end())
            {
                glog.is_warn() && glog << "App: " << proc.main().name()
                                       << " is not reponding, Error Message: " << it->second
                                       << std::endl;
                last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(it->second);
            }
            else
            {
                glog.is_warn() &&
                    glog << "App: " << proc.main().name()
                         << " is not responding but has not been mapped to an ERROR enumeration"
                         << std::endl;
                last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(protobuf::ERROR__NOT_RESPONDING__UNKNOWN_APP);
            }
        }
    }
}

jaiabot::apps::JaiabotProduction::~JaiabotProduction()
{


}

void jaiabot::apps::JaiabotProduction::loop()
{



}

//these code blocks might be important for the motor harness
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

void jaiabot::apps::MotorStatusThread::send_rpm_query()
{
    glog.is_debug2() && glog << group(thread_name()) << "Sending RPM Query: " << std::endl;
    // send an empty packet to provide the python driver with a return address
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<jaiabot::groups::motor_udp_out>(io_data);
}

void jaiabot::apps::MotorStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_motor_rpm_report_time_ + std::chrono::seconds(cfg().motor_rpm_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on RPM listener" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_RPM_LISTENER);
    }

    if (last_motor_thermistor_report_time_ + std::chrono::seconds(cfg().motor_thermistor_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on thermistor data" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_ARDUINO_MOTOR_TEMP);
    }

    health.set_state(health_state);
}

