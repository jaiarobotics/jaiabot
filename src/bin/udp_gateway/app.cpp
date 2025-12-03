// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Edited by Ed Sanville <edsanville@gmail.com>
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

#include <numeric>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/util/seawater/units.h>
#include <goby/zeromq/application/multi_thread.h>
#include <iostream>

#include "bin/udp_gateway/config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"
#include "jaiabot/messages/moos.pb.h"

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

    void send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_dst);
    void received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope);

  private:
    dccl::Codec dccl_;
    bool helm_ivp_in_mission_{false};
    goby::time::SteadyClock::time_point last_imu_trigger_issue_time_{
        goby::time::SteadyClock::now()};

    // IMU data tracking
    goby::time::SteadyClock::time_point last_imu_data_time_{std::chrono::seconds(0)};
    goby::middleware::protobuf::UDPEndPoint imu_udp_src_;

    // Salinity data tracking
    goby::time::SteadyClock::time_point last_salinity_data_time_{std::chrono::seconds(0)};
    goby::middleware::protobuf::UDPEndPoint salinity_udp_src_;

    // For processing salinity data
    jaiabot::protobuf::PressureTemperatureData last_pressure_temperature_data_;
    jaiabot::protobuf::PressureAdjustedData last_pressure_adjusted_data_;
    jaiabot::protobuf::SalinityData process_salinity_data(const jaiabot::protobuf::SalinityData& salinity_data);

    // PressureTemperature data tracking
    goby::time::SteadyClock::time_point last_pressure_temperature_data_time_{std::chrono::seconds(0)};
    goby::middleware::protobuf::UDPEndPoint pressure_temperature_udp_src_;
    jaiabot::protobuf::PressureTemperatureData process_pressure_temperature_data(const jaiabot::protobuf::PressureTemperatureData& pressure_temperature_data);

    // TSYS01 data tracking
    goby::time::SteadyClock::time_point last_tsys01_data_time_{std::chrono::seconds(0)};

};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::UDPGateway>(
        goby::middleware::ProtobufConfigurator<config::UDPGateway>(argc, argv));
}

// Main thread

double loop_freq = 10.0; // Hz

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

            // Process the contents of the envelope
            switch(envelope.payload_case())
            {
                case jaiabot::protobuf::UDPGatewayEnvelope::kImuData:
                {
                    interprocess().publish<groups::imu>(envelope.imu_data());
                    last_imu_data_time_ = goby::time::SteadyClock::now();
                    imu_udp_src_ = data.udp_src();
                    glog.is_debug1() && glog << "Received IMUData" << endl;
                    break;
                }
                case jaiabot::protobuf::UDPGatewayEnvelope::kSalinityData:
                {
                    glog.is_debug1() && glog << "Received SalinityData" << endl;
                    auto salinity_data = process_salinity_data(envelope.salinity_data());
                    interprocess().publish<groups::salinity>(envelope.salinity_data());
                    last_salinity_data_time_ = goby::time::SteadyClock::now();
                    salinity_udp_src_ = data.udp_src();
                    break;
                }
                case jaiabot::protobuf::UDPGatewayEnvelope::kPressureTemperatureData:
                {
                    glog.is_debug1() && glog << "Received PressureTemperatureData" << endl;
                    auto pressure_temperature_data = process_pressure_temperature_data(envelope.pressure_temperature_data());
                    interprocess().publish<jaiabot::groups::pressure_temperature>(pressure_temperature_data);
                    last_pressure_temperature_data_time_ = goby::time::SteadyClock::now();
                    pressure_temperature_udp_src_ = data.udp_src();
                    break;
                }
                case jaiabot::protobuf::UDPGatewayEnvelope::kTsys01Data:
                {
                    interprocess().publish<groups::tsys01>(envelope.tsys01_data());
                    last_tsys01_data_time_ = goby::time::SteadyClock::now();
                    glog.is_debug1() && glog << "Received TSYS01Data" << endl;
                    break;
                }
                default:
                {
                    glog.is_warn() && glog << "Received unknown payload in UDPGatewayEnvelope"
                                        << endl;
                    break;
                }
            }

        });

    interprocess().subscribe<jaiabot::groups::moos>(
        [this](const protobuf::MOOSMessage& moos_msg)
        {
            if (moos_msg.key() == "JAIABOT_MISSION_STATE")
            {
                if (moos_msg.svalue() == "IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT")
                {
                    helm_ivp_in_mission_ = true;
                }
                else
                {
                    helm_ivp_in_mission_ = false;
                }
            }
        });

    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const protobuf::IMUCommand& imu_command)
        {
            send_imu_command(imu_command);
        });

    interprocess().subscribe<jaiabot::groups::pressure_adjusted>(
        [this](const jaiabot::protobuf::PressureAdjustedData& pressure_adjusted_data)
        {
            last_pressure_adjusted_data_ = pressure_adjusted_data;
        });
    
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pressure_temperature_data)
        {
            last_pressure_temperature_data_ = pressure_temperature_data;
        });
    
}



void jaiabot::apps::UDPGateway::send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_dst) {
    if (!udp_dst.has_addr() || !udp_dst.has_port()) {
        glog.is_warn() && glog << "UDP destination is not set, cannot send UDPGatewayEnvelope"
                               << endl;
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


void jaiabot::apps::UDPGateway::loop()
{
    auto command = jaiabot::protobuf::IMUCommand();
    command.set_type(jaiabot::protobuf::IMUCommand::TAKE_READING);
    send_imu_command(command);
}

jaiabot::protobuf::SalinityData jaiabot::apps::UDPGateway::process_salinity_data(const jaiabot::protobuf::SalinityData& salinity_data) {
    jaiabot::protobuf::SalinityData processed_data = salinity_data;

    // TODO: Move these calculations to the jaiabot_fusion app?
    if (last_pressure_temperature_data_.has_temperature())
    {
        const double specific_conductivity = calculate_specific_conductivity(
            salinity_data.conductivity_raw(), last_pressure_temperature_data_.temperature());
        processed_data.set_conductivity(specific_conductivity);
    }

    if (last_pressure_temperature_data_.has_temperature() &&
        last_pressure_adjusted_data_.has_pressure_adjusted())
    {
        const double ATMOSPHERIC_PRESSURE_DECIBARS = 10.1325;
        const double salinity = calculate_derived_salinity(
            salinity_data.conductivity_raw(), last_pressure_temperature_data_.temperature(),
            last_pressure_adjusted_data_.pressure_adjusted() +
                ATMOSPHERIC_PRESSURE_DECIBARS);
        processed_data.set_salinity(salinity);
    }
    // Up to here

    return processed_data;
}

jaiabot::protobuf::PressureTemperatureData jaiabot::apps::UDPGateway::process_pressure_temperature_data(const jaiabot::protobuf::PressureTemperatureData& pressure_temperature_data) {
    jaiabot::protobuf::PressureTemperatureData processed_data = pressure_temperature_data;

    if (processed_data.has_pressure_raw())
    {
        double pressure_raw = processed_data.pressure_raw();
        processed_data.set_pressure_raw_with_units(pressure_raw * si::milli *
                                                                goby::util::seawater::bar);
    }

    // TODO: Shouldn't this already have units from the DCCL field metadata?
    if (processed_data.has_temperature())
    {
        double temperature = processed_data.temperature();
        processed_data.set_temperature_with_units(
            temperature * boost::units::absolute<boost::units::celsius::temperature>());
    }

    return processed_data;
}

// Health checks

void jaiabot::apps::UDPGateway::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the sensors are reporting
    if (cfg().in_simulation())
    {
        if (helm_ivp_in_mission_)
        {
            glog.is_debug1() &&
                glog << "Simulation Sensor Check (TODO: add simulation for sensors)"
                     << std::endl;
            //TODO: add simulation for this sensor
            //check_last_report(health, health_state);
        }
    }
    else
    {
        check_last_report(health, health_state);
    }

    health.set_state(health_state);
}

void jaiabot::apps::UDPGateway::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{

    // IMU timeout check
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

    // Salinity data timeout check
    if (last_salinity_data_time_ +
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
    if (last_pressure_temperature_data_time_ +
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
    if (last_tsys01_data_time_ +
            std::chrono::seconds(cfg().tsys01_data_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on TSYS01 temperature sensor" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER);
    }

}
