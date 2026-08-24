// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Ed Sanville <edsanville@gmail.com>
//
//
// This file is part of the JaiaBot Hydro Project Binaries
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

#include <iostream>
#include <numeric>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <dccl/codec.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/marshalling/protobuf.h>
#include <goby/util/constants.h>
#include <goby/util/seawater/units.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"
#include "jaiabot/messages/moos.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/mission.pb.h"

#include "jaiabot/intervehicle.h"
#include "jaiabot/utils/derived_salinity.h"
#include "jaiabot/utils/specific_conductivity.h"

using goby::glog;
using namespace std;

namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group udp_gateway_in{"udp_gateway_in"};
constexpr goby::middleware::Group udp_gateway_out{"udp_gateway_out"};

class UDPGateway
    : public zeromq::MultiThreadApplication<config::UDPGateway>
{
  public:
    UDPGateway();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

    void send_imu_command(const jaiabot::protobuf::IMUCommand& imu_command);
    void send_echo_command(const jaiabot::protobuf::EchoCommand& echo_command);
    void send_currents_and_waves_estimator_payload(
        const jaiabot::protobuf::CurrentsAndWavesEstimatorPayload& currents_and_waves_estimator_payload);

    void send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_dst);
    void process_received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_src);

  private:
    dccl::Codec dccl_;
    bool helm_ivp_in_mission_{false};
    bool rf_enabled_{true};
    goby::time::SteadyClock::time_point last_imu_trigger_issue_time_{
        goby::time::SteadyClock::now()};

    // IMU data tracking
    goby::time::SteadyClock::time_point last_imu_data_time_{std::chrono::seconds(0)};
    goby::middleware::protobuf::UDPEndPoint imu_udp_src_;

    // Salinity data tracking
    goby::time::SteadyClock::time_point last_salinity_data_time_{std::chrono::seconds(0)};
    goby::middleware::protobuf::UDPEndPoint salinity_udp_src_;

    // PressureTemperature data tracking
    goby::time::SteadyClock::time_point last_pressure_temperature_data_time_{std::chrono::seconds(0)};

    // TSYS01 data tracking
    goby::time::SteadyClock::time_point last_tsys01_data_time_{std::chrono::seconds(0)};

    // Echo data tracking
    jaiabot::protobuf::EchoData latest_echo_data_;
    goby::time::SteadyClock::time_point last_echo_data_time_{std::chrono::seconds(0)};
    goby::time::SteadyClock::time_point last_echo_trigger_issue_time_{
        goby::time::SteadyClock::now()};
    goby::middleware::protobuf::UDPEndPoint echo_udp_src_;
    goby::middleware::protobuf::UDPEndPoint ppk_udp_src_;

    // Currents and Waves Estimator data tracking
    goby::time::SteadyClock::time_point last_currents_and_waves_estimation_time_{
        std::chrono::seconds(0)};
    goby::middleware::protobuf::UDPEndPoint currents_and_waves_estimator_udp_src_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::UDPGateway>(
        goby::middleware::ProtobufConfigurator<config::UDPGateway>(argc, argv));
}

// Main thread

double loop_freq = 1.0; // Hz

jaiabot::apps::UDPGateway::UDPGateway()
    : zeromq::MultiThreadApplication<config::UDPGateway>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using UDPThread =
        goby::middleware::io::UDPOneToManyThread<udp_gateway_in, udp_gateway_out>;
    launch_thread<UDPThread>(cfg().udp_config());


    glog.is_verbose() && glog << "Config : " << cfg().ShortDebugString() << endl;

    interthread().subscribe<udp_gateway_in>(
        [this](const goby::middleware::protobuf::IOData& data)
        {
            // Deserialize from the UDP packet
            glog.is_debug2() && glog << "Received UDP packet of size "
                                     << data.data().size() << " bytes"
                                     << endl;

            jaiabot::protobuf::UDPGatewayEnvelope envelope;
            if (!envelope.ParseFromString(data.data()))
            {
                glog.is_warn() && glog << "Couldn't deserialize UDPGatewayEnvelope from the UDP packet"
                                       << endl;
                return;
            }

            process_received_envelope(envelope, data.udp_src());

        });

    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const protobuf::IMUCommand& imu_command)
        {
            send_imu_command(imu_command);
        });

    interprocess().subscribe<jaiabot::groups::echo>(
        [this](const protobuf::EchoCommand& echo_command) {
            send_echo_command(echo_command);
        });

    interprocess().subscribe<jaiabot::groups::arduino_to_pi>(
        [this](const jaiabot::protobuf::ArduinoResponse& arduino_response)
        {
            jaiabot::protobuf::CurrentsAndWavesEstimatorPayload
                currents_and_waves_estimator_payload;
            *currents_and_waves_estimator_payload.mutable_arduino_response() = arduino_response;
            send_currents_and_waves_estimator_payload(currents_and_waves_estimator_payload);
        });

    interprocess().subscribe<jaiabot::groups::mission_report>(
        [this](const protobuf::MissionReport& mission_report)
        {
            jaiabot::protobuf::CurrentsAndWavesEstimatorPayload
                currents_and_waves_estimator_payload;
            *currents_and_waves_estimator_payload.mutable_mission_report() = mission_report;
            send_currents_and_waves_estimator_payload(currents_and_waves_estimator_payload);
        });

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv)
        {
            jaiabot::protobuf::CurrentsAndWavesEstimatorPayload
                currents_and_waves_estimator_payload;
            *currents_and_waves_estimator_payload.mutable_time_position_velocity() = tpv;
            send_currents_and_waves_estimator_payload(currents_and_waves_estimator_payload);
        });

    // handle rf disable commands to make sure task packets are not sent
    interprocess().subscribe<jaiabot::groups::powerstate_command>(
        [this](const jaiabot::protobuf::Engineering& power_rf)
        {
            if (power_rf.has_rf_disable_options())
            {
                if (power_rf.rf_disable_options().has_rf_disable())
                {
                    if (power_rf.rf_disable_options().rf_disable())
                    {
                        this->rf_enabled_ = false;
                    }
                    else
                    {
                        this->rf_enabled_ = true;
                    }
                }
            }
        });
}


void jaiabot::apps::UDPGateway::process_received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_src)
{
    // Process the contents of the envelope
    switch(envelope.payload_case())
    {
        case jaiabot::protobuf::UDPGatewayEnvelope::kImuData:
        {
            interprocess().publish<groups::imu>(envelope.imu_data());
            last_imu_data_time_ = goby::time::SteadyClock::now();
            imu_udp_src_ = udp_src;
            glog.is_debug1() && glog << "Received IMUData" << endl;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kSalinityData:
        {
            glog.is_debug1() && glog << "Received SalinityData" << endl;
            interprocess().publish<groups::raw_salinity>(envelope.salinity_data());
            last_salinity_data_time_ = goby::time::SteadyClock::now();
            salinity_udp_src_ = udp_src;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kPressureTemperatureData:
        {
            glog.is_debug1() && glog << "Received PressureTemperatureData" << endl;
            auto pressure_temperature_data = envelope.pressure_temperature_data();
            if (envelope.pressure_temperature_data().has_pressure_raw())
            {
                double pressure_raw = envelope.pressure_temperature_data().pressure_raw();
                pressure_temperature_data.set_pressure_raw_with_units(pressure_raw * si::milli *
                                                                      goby::util::seawater::bar);
            }

            if (envelope.pressure_temperature_data().has_temperature())
            {
                double temperature = pressure_temperature_data.temperature();
                pressure_temperature_data.set_temperature_with_units(
                    temperature * boost::units::absolute<boost::units::celsius::temperature>());
            }
            interprocess().publish<jaiabot::groups::pressure_temperature>(
                pressure_temperature_data);
            last_pressure_temperature_data_time_ = goby::time::SteadyClock::now();
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kTsys01Data:
        {
            interprocess().publish<groups::tsys01>(envelope.tsys01_data());
            last_tsys01_data_time_ = goby::time::SteadyClock::now();
            glog.is_debug1() && glog << "Received TSYS01Data" << endl;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kEchoData:
        {
            interprocess().publish<groups::echo>(envelope.echo_data());
            last_echo_data_time_ = goby::time::SteadyClock::now();
            echo_udp_src_ = udp_src;
            glog.is_debug1() && glog << "Received EchoData" << endl;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kCurrentsAndWavesEstimatorPayload:
        {
            glog.is_debug1() && glog << "Received CurrentsAndWavesEstimatorPayload" << endl;
            if (envelope.currents_and_waves_estimator_payload().has_heartbeat())
            {
                last_currents_and_waves_estimation_time_ = goby::time::SteadyClock::now();
                currents_and_waves_estimator_udp_src_ = udp_src;
            }
            if (envelope.currents_and_waves_estimator_payload().has_task_packet())
            {
                auto task_packet = envelope.currents_and_waves_estimator_payload().task_packet();
                last_currents_and_waves_estimation_time_ = goby::time::SteadyClock::now();
                currents_and_waves_estimator_udp_src_ = udp_src;

                if (this->rf_enabled_)
                {
                    glog.is_debug1() && glog << "(RF Enabled) Publishing task packet "
                                                "intervehicle: "
                                             << task_packet.DebugString() << std::endl;
                    intervehicle().publish<groups::task_packet>(
                        task_packet, intervehicle::default_publisher<protobuf::TaskPacket>);
                }
                else
                {
                    glog.is_debug1() && glog << "(RF Disabled) Publishing task packet "
                                                "interprocess: "
                                             << task_packet.DebugString() << std::endl;
                    interprocess().publish<groups::task_packet>(task_packet);
                }
            }
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kUbxChunk:
        {
            interprocess().publish<groups::ppk>(envelope.ubx_chunk());
            ppk_udp_src_ = udp_src;
            glog.is_debug1() && glog << "Received UBXChunk" << endl;
            break;
        }
        default:
        {
            glog.is_warn() && glog << "Received unknown payload in UDPGatewayEnvelope"
                                << endl;
            break;
        }
    }
}


void jaiabot::apps::UDPGateway::send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_dst) {
    if (!udp_dst.has_addr() || !udp_dst.has_port()) {
        glog.is_warn() && glog << "UDP destination is not set, cannot send UDPGatewayEnvelope: "
                               << envelope.DebugString() << endl;
        return;
    }

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->mutable_udp_dest()->set_addr(udp_dst.addr());
    io_data->mutable_udp_dest()->set_port(udp_dst.port());
    io_data->set_data(envelope.SerializeAsString());
    interthread().publish<udp_gateway_out>(io_data);

    glog.is_debug1() && glog << "Sent UDPGatewayEnvelope: " << envelope.ShortDebugString()
                             << endl;
}


void jaiabot::apps::UDPGateway::send_imu_command(const jaiabot::protobuf::IMUCommand& imu_command) {
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_imu_command() = imu_command;
    send_envelope(envelope, imu_udp_src_);
}


void jaiabot::apps::UDPGateway::send_echo_command(const jaiabot::protobuf::EchoCommand& echo_command) {
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_echo_command() = echo_command;
    send_envelope(envelope, echo_udp_src_);
}

void jaiabot::apps::UDPGateway::send_currents_and_waves_estimator_payload(
    const jaiabot::protobuf::CurrentsAndWavesEstimatorPayload& currents_and_waves_estimator_payload)
{
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_currents_and_waves_estimator_payload() = currents_and_waves_estimator_payload;
    send_envelope(envelope, currents_and_waves_estimator_udp_src_);
}

void jaiabot::apps::UDPGateway::loop()
{
}

// Health checks

void jaiabot::apps::UDPGateway::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the sensors are reporting
    check_last_report(health, health_state);

    health.set_state(health_state);
}

void jaiabot::apps::UDPGateway::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{

    // IMU timeout check
    // We don't simulate the IMU driver, so skip this check in sim mode.
    // The jaiabot_simulator app currently publishes IMU data directly.
    if (!cfg().in_simulation()) { 
        if (last_imu_data_time_ +
                std::chrono::seconds(cfg().imu_data_report_timeout_seconds()) <
            goby::time::SteadyClock::now())
        {
            glog.is_warn() && glog << "Timeout on IMU data" << std::endl;
            health_state = goby::middleware::protobuf::HEALTH__FAILED;
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_IMU);

            // Wait a certain amount of time before publishing issue
            if (last_imu_trigger_issue_time_ +
                    std::chrono::seconds(cfg().imu_trigger_issue_timeout_seconds()) <
                goby::time::SteadyClock::now())
            {
                jaiabot::protobuf::IMUIssue imu_issue;
                imu_issue.set_solution(cfg().imu_issue_solution());
                interprocess().publish<jaiabot::groups::imu>(imu_issue);
                last_imu_trigger_issue_time_ = goby::time::SteadyClock::now();
            }
        }
    }

    // Salinity data timeout check
    if (cfg().salinity_enabled() && last_salinity_data_time_ +
        std::chrono::seconds(cfg().salinity_data_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on salinity data" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER);
    }

    // Pressure temperature data timeout check
    if (cfg().bar30_enabled() && last_pressure_temperature_data_time_ +
        std::chrono::seconds(cfg().pressure_temperature_data_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on pressure temperature data" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER);
    }

    // TSYS01 data timeout check
    if (cfg().tsys01_enabled() && last_tsys01_data_time_ + std::chrono::seconds(cfg().tsys01_data_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on TSYS01 temperature sensor" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER);
    }

    // Echo data timeout check
    if (cfg().echo_enabled() && last_echo_data_time_ + std::chrono::seconds(cfg().echo_data_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on echo" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_ECHO_DRIVER);

        // Wait a certain amount of time before publishing issue
        if (last_echo_trigger_issue_time_ +
                std::chrono::seconds(cfg().echo_trigger_issue_timeout_seconds()) <
            goby::time::SteadyClock::now())
        {
            jaiabot::protobuf::EchoIssue echo_issue;
            echo_issue.set_solution(cfg().echo_issue_solution());
            interprocess().publish<jaiabot::groups::echo>(echo_issue);
            last_echo_trigger_issue_time_ = goby::time::SteadyClock::now();
        }
    }

    // Current and Waves Estimation Heartbeat timeout check
    if (cfg().currents_and_waves_estimation_enabled() &&
        last_currents_and_waves_estimation_time_ +
                std::chrono::seconds(
                    cfg().currents_and_waves_estimation_heartbeat_report_timeout_seconds()) <
            goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on Currents and Waves Estimator" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_CURRENTS_AND_WAVE_ESTIMATOR);
    }
}
