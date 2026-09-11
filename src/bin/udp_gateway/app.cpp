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

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group udp_gateway_in{"udp_gateway_in"};
constexpr goby::middleware::Group udp_gateway_out{"udp_gateway_out"};

class UDPGateway : public zeromq::MultiThreadApplication<config::UDPGateway>
{
  public:
    UDPGateway();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    void send_imu_command(const jaiabot::protobuf::IMUCommand& imu_command);
    void send_pam_command(const jaiabot::protobuf::PamCommand& pam_command);

    void send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope,
                       const goby::middleware::protobuf::UDPEndPoint& udp_dst);
    void process_received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope,
                                   const goby::middleware::protobuf::UDPEndPoint& udp_src);

  private:
    // remembered so a command can be addressed back to the driver that last reported
    goby::middleware::protobuf::UDPEndPoint imu_udp_src_;
    goby::middleware::protobuf::UDPEndPoint pam_udp_src_;
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

    using UDPThread = goby::middleware::io::UDPOneToManyThread<udp_gateway_in, udp_gateway_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    glog.is_verbose() && glog << "Config : " << cfg().ShortDebugString() << endl;

    interthread().subscribe<udp_gateway_in>(
        [this](const goby::middleware::protobuf::IOData& data)
        {
            // Deserialize from the UDP packet
            glog.is_debug2() && glog << "Received UDP packet of size " << data.data().size()
                                     << " bytes" << endl;

            jaiabot::protobuf::UDPGatewayEnvelope envelope;
            if (!envelope.ParseFromString(data.data()))
            {
                glog.is_warn() &&
                    glog << "Couldn't deserialize UDPGatewayEnvelope from the UDP packet" << endl;
                return;
            }

            process_received_envelope(envelope, data.udp_src());
        });

    interprocess().subscribe<jaiabot::groups::imu>([this](const protobuf::IMUCommand& imu_command)
                                                   { send_imu_command(imu_command); });

    interprocess().subscribe<jaiabot::groups::pam>([this](const protobuf::PamCommand& pam_command)
                                                   { send_pam_command(pam_command); });
}

void jaiabot::apps::UDPGateway::process_received_envelope(
    const jaiabot::protobuf::UDPGatewayEnvelope& envelope,
    const goby::middleware::protobuf::UDPEndPoint& udp_src)
{
    // Process the contents of the envelope
    switch (envelope.payload_case())
    {
        case jaiabot::protobuf::UDPGatewayEnvelope::kImuData:
        {
            interprocess().publish<groups::imu>(envelope.imu_data());
            imu_udp_src_ = udp_src;
            glog.is_debug1() && glog << "Received IMUData" << endl;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kSalinityData:
        {
            glog.is_debug1() && glog << "Received SalinityData" << endl;
            interprocess().publish<groups::raw_salinity>(envelope.salinity_data());
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
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kTsys01Data:
        {
            interprocess().publish<groups::tsys01>(envelope.tsys01_data());
            glog.is_debug1() && glog << "Received TSYS01Data" << endl;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kPamData:
        {
            interprocess().publish<groups::pam>(envelope.pam_data());
            pam_udp_src_ = udp_src;
            glog.is_debug1() && glog << "Received PamData" << endl;
            break;
        }
        case jaiabot::protobuf::UDPGatewayEnvelope::kUbxChunk:
        {
            interprocess().publish<groups::ppk>(envelope.ubx_chunk());
            glog.is_debug1() && glog << "Received UBXChunk" << endl;
            break;
        }
        default:
        {
            glog.is_warn() && glog << "Received unknown payload in UDPGatewayEnvelope" << endl;
            break;
        }
    }
}

void jaiabot::apps::UDPGateway::send_envelope(
    const jaiabot::protobuf::UDPGatewayEnvelope& envelope,
    const goby::middleware::protobuf::UDPEndPoint& udp_dst)
{
    if (!udp_dst.has_addr() || !udp_dst.has_port())
    {
        glog.is_warn() && glog << "UDP destination is not set, cannot send UDPGatewayEnvelope"
                               << endl;
        return;
    }

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->mutable_udp_dest()->set_addr(udp_dst.addr());
    io_data->mutable_udp_dest()->set_port(udp_dst.port());
    io_data->set_data(envelope.SerializeAsString());
    interthread().publish<udp_gateway_out>(io_data);

    glog.is_debug1() && glog << "Sent UDPGatewayEnvelope: " << envelope.ShortDebugString() << endl;
}

void jaiabot::apps::UDPGateway::send_imu_command(const jaiabot::protobuf::IMUCommand& imu_command)
{
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_imu_command() = imu_command;
    send_envelope(envelope, imu_udp_src_);
}

void jaiabot::apps::UDPGateway::send_pam_command(const jaiabot::protobuf::PamCommand& pam_command)
{
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_pam_command() = pam_command;
    send_envelope(envelope, pam_udp_src_);
}

void jaiabot::apps::UDPGateway::loop() {}

// Health checks

void jaiabot::apps::UDPGateway::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.set_name(this->app_name());
    health.set_state(goby::middleware::protobuf::HEALTH__OK);
}
