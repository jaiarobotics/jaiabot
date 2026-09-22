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

#include <unordered_map>

#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/marshalling/protobuf.h>
#include <goby/util/constants.h>
#include <goby/util/seawater/units.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"

using goby::glog;
using namespace std;

namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

// Clients that subscribe to messages should send a subscribe command regularly,
// to let jaiabot_udp_gateway know that they are still active.
const std::chrono::seconds SUBSCRIBER_TIMEOUT{300};

// We need to define a comparison operator, so we can build a set of UDPEndPoint
namespace goby
{
namespace middleware
{
namespace protobuf
{
bool operator==(const goby::middleware::protobuf::UDPEndPoint a,
                const goby::middleware::protobuf::UDPEndPoint b)
{
    return a.addr() == b.addr() && a.port() == b.port();
}
} // namespace protobuf
} // namespace middleware
} // namespace goby

// Define a hash for unordered_map
class UDPEndPointHash
{
  public:
    size_t operator()(const goby::middleware::protobuf::UDPEndPoint& p) const
    {
        std::string key = p.addr() + std::to_string(p.port());
        return std::hash<std::string>()(key);
    }
};

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

    void send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_dst);
    void process_received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_src);

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

    // Subscriptions
    std::unordered_map<goby::middleware::protobuf::UDPEndPoint, goby::time::SteadyClock::time_point,
                       UDPEndPointHash>
        bot_status_subscribers_;
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

    interprocess().subscribe<jaiabot::groups::bot_status>(
        [this](const protobuf::BotStatus& bot_status)
        {
            // We will purge clients who haven't sent a subscribe command in a while, to avoid sending bot status to clients that are no longer listening.
            const auto now = goby::time::SteadyClock::now();
            auto timeout = now - SUBSCRIBER_TIMEOUT;
            std::vector<goby::middleware::protobuf::UDPEndPoint> stale_subscribers;

            // Send the bot status to all active subscribers
            for (const auto& [udp_dst, last_subscribe_command_received] : bot_status_subscribers_)
            {
                if (last_subscribe_command_received < timeout)
                {
                    glog.is_debug1() && glog << "Removing bot status subscriber " << udp_dst.addr()
                                             << ":" << udp_dst.port() << " due to timeout" << endl;
                    stale_subscribers.push_back(udp_dst);
                    continue;
                }

                auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
                *envelope.mutable_bot_status() = bot_status;
                send_envelope(envelope, udp_dst);
            }

            // Remove stale subscribers
            for (const auto& udp_dst : stale_subscribers)
            {
                bot_status_subscribers_.erase(udp_dst);
                glog.is_warn() && glog << "Removed bot status subscriber " << udp_dst.addr() << ":"
                                       << udp_dst.port() << " due to timeout" << endl;
            }
        });
}


void jaiabot::apps::UDPGateway::process_received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope, const goby::middleware::protobuf::UDPEndPoint& udp_src)
{
    // Process the contents of the envelope
    switch(envelope.payload_case())
    {
        case jaiabot::protobuf::UDPGatewayEnvelope::kSubscribeCommand:
        {
            glog.is_debug1() && glog << "Received SubscribeCommand" << endl;

            switch (envelope.subscribe_command())
            {
                case jaiabot::protobuf::UDPGatewayEnvelope::BOT_STATUS:
                {
                    glog.is_verbose() && glog << "Received SubscribeCommand: BOT_STATUS" << endl;
                    bot_status_subscribers_[udp_src] = goby::time::SteadyClock::now();
                    break;
                }
                default:
                {
                    glog.is_warn() && glog << "Received unknown SubscribeCommand" << endl;
                    break;
                }
            }

            break;
        }
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


void jaiabot::apps::UDPGateway::send_echo_command(const jaiabot::protobuf::EchoCommand& echo_command) {
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_echo_command() = echo_command;
    send_envelope(envelope, echo_udp_src_);
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

}
