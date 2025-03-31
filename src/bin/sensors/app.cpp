// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
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

#include <boost/crc.hpp>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/io/cobs/serial.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "drivers/atlas_scientific__oem_ec.h"
#include "drivers/blue_robotics_bar30.h"
#include "jaiabot/crc/crc32.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/sensor/catalog.pb.h"
#include "jaiabot/messages/sensor/sensor_core.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

// raw IOData
constexpr goby::middleware::Group mcu_serial_in{"jaiabot::sensors::mcu_serial_in"};
constexpr goby::middleware::Group mcu_serial_out{"jaiabot::sensors::mcu_serial_out"};

namespace jaiabot
{
namespace apps
{
class Sensors : public zeromq::MultiThreadApplication<config::Sensors>
{
  public:
    Sensors();

  private:
    void loop() override;
    void query_metadata();
    void send_to_mcu(sensor::protobuf::SensorRequest request);
    void receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg);
    void receive_metadata_from_mcu(const sensor::protobuf::Metadata& metadata);

    template <typename C> std::uint32_t compute_crc32(C begin, C end)
    {
        crc32_calc_.process_bytes(&(*begin), end - begin);
        return crc32_calc_.checksum();
    }

  private:
    std::set<jaiabot::sensor::protobuf::Sensor> drivers_launched_;
    boost::crc_32_type crc32_calc_;
};

void hex_string_to_bytes(const char* hex, uint8_t* bytes, size_t length)
{
    for (size_t i = 0; i < length; i++) { sscanf(&hex[i * 2], "%2hhx", &bytes[i]); }
}

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Sensors>(
        goby::middleware::ProtobufConfigurator<config::Sensors>(argc, argv));
}

// Main thread
jaiabot::apps::Sensors::Sensors()
    : zeromq::MultiThreadApplication<config::Sensors>(0.1 * boost::units::si::hertz)
{
    using MCUSerialThread =
        goby::middleware::io::SerialThreadCOBS<mcu_serial_in, mcu_serial_out,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD>;

    // receive data from MCU
    interthread().subscribe<mcu_serial_in>([this](const goby::middleware::protobuf::IOData& io_msg)
                                           { receive_from_mcu(io_msg); });

    // send requests from driver threads
    interthread().subscribe<jaiabot::groups::mcu_pb_data_out>(
        [this](const sensor::protobuf::SensorRequest& request) { send_to_mcu(request); });

    launch_thread<MCUSerialThread>(cfg().mcu_serial());
}

void jaiabot::apps::Sensors::loop()
{
    if (drivers_launched_.size() == 0)
    {
        // keep querying the MCU until it responds with at least one sensor
        query_metadata();
    }
}

void jaiabot::apps::Sensors::query_metadata()
{
    sensor::protobuf::SensorRequest request;
    request.set_request_metadata(true);
    send_to_mcu(request);
}

void jaiabot::apps::Sensors::send_to_mcu(sensor::protobuf::SensorRequest request)
{
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    auto io_msg = std::make_shared<goby::middleware::protobuf::IOData>();
    std::string* encoded = io_msg->mutable_data();
    request.SerializeToString(encoded);

    std::string hex_str = goby::util::hex_encode(io_msg->data());
    size_t length = hex_str.size() / 2;
    uint8_t data[length];
    hex_string_to_bytes(hex_str.c_str(), data, length);
    uint32_t crc32_value = crc::calculate_crc32(data, length);

    constexpr int bits_in_byte = 8;
    constexpr int bytes_in_crc32 = 4;

    for (int i = bytes_in_crc32 - 1; i >= 0; --i)
    {
        encoded->push_back((crc32_value >> (i * bits_in_byte)) & 0xFF);
    }

    glog.is_debug1() && glog << "Sending bytes to MCU: " << goby::util::hex_encode(io_msg->data())
                             << std::endl;

    interthread().publish<mcu_serial_out>(io_msg);
}

void jaiabot::apps::Sensors::receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg)
{
    constexpr int bits_in_byte = 8;
    constexpr int bytes_in_crc32 = 4;

    try
    {
        glog.is_debug1() && glog << "Received bytes from MCU: "
                                 << goby::util::hex_encode(io_msg.data()) << std::endl;

        const auto& encoded = io_msg.data();
        std::vector<uint8_t> mcu_bytes(encoded.begin(), encoded.end());

        if (mcu_bytes.size() < bytes_in_crc32)
            throw(std::runtime_error("Message is too small"));

        uint32_t computed_crc =
            crc::calculate_crc32(mcu_bytes.data(), mcu_bytes.size() - bytes_in_crc32);
        uint32_t provided_crc = 0;

        std::size_t i = 0;
        for (auto it = encoded.rbegin(), end = encoded.rbegin() + bytes_in_crc32; it != end;
             ++it, ++i)
            provided_crc |= (*it) << (i * bits_in_byte);

        if (computed_crc != provided_crc)
        {
            throw(std::runtime_error("Computed CRC (" + std::to_string(computed_crc) +
                                     ") does not equal CRC on message (" +
                                     std::to_string(provided_crc) + ")"));
        }

        sensor::protobuf::SensorData sensor_data;
        sensor_data.ParseFromArray(encoded.data(), encoded.size() - bytes_in_crc32);

        glog.is_verbose() && glog << "Received data from MCU: " << sensor_data.ShortDebugString()
                                  << std::endl;

        // publish for appropriate thread and for logging
        interprocess().publish<jaiabot::groups::mcu_pb_data_in>(sensor_data);

        if (sensor_data.has_metadata())
            receive_metadata_from_mcu(sensor_data.metadata());
    }
    catch (std::exception& e)
    {
        glog.is_warn() && glog << "Failed to decode message from MCU: " << e.what() << std::endl;
    }
}

void jaiabot::apps::Sensors::receive_metadata_from_mcu(const sensor::protobuf::Metadata& metadata)
{
    if (drivers_launched_.count(metadata.sensor()))
    {
        glog.is_warn() && glog << "Driver already launched for sensor: "
                               << sensor::protobuf::Sensor_Name(metadata.sensor())
                               << ", not launching another." << std::endl;

        return;
    }

    switch (metadata.sensor())
    {
        case sensor::protobuf::ATLAS_SCIENTIFIC__OEM_EC:
            launch_thread<AtlasScientificOEMECDriver>(metadata);
            break;

        case sensor::protobuf::BLUE_ROBOTICS__BAR30:
            launch_thread<BlueRoboticsBar30Driver>(metadata);
            break;
        case sensor::protobuf::ATLAS_SCIENTIFIC__OEM_PH:
        case sensor::protobuf::ATLAS_SCIENTIFIC__OEM_DO:
        case sensor::protobuf::TURNER__C_FLUOR:
        default:
            glog.is_warn() && glog << "Driver not implemented for sensor: "
                                   << sensor::protobuf::Sensor_Name(metadata.sensor()) << std::endl;
    }

    drivers_launched_.insert(metadata.sensor());
}
