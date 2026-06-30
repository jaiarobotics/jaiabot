// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Nick Marshall <nick.marshall@jaia.tech>
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
#include "jaiabot/crc/crc32.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/power_board.pb.h"
#include "jaiabot/messages/health.pb.h"

using goby::glog;

namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

// raw IO Data
constexpr goby::middleware::Group power_board_serial_in{"jaiabot::power_board::power_board_serial_in"};
constexpr goby::middleware::Group power_board_serial_out{"jaiabot::power_board::power_board_serial_out"};

namespace jaiabot
{
namespace apps
{
class PowerBoard : public zeromq::MultiThreadApplication<config::PowerBoardConfig>
{
  public:
    PowerBoard();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void query_metadata();
    void send_to_mcu(const jaiabot::protobuf::PowerBoardRequest& request);
    void receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg);
    void receive_metadata_from_mcu(const jaiabot::protobuf::Metadata& metadata);

  private:
    boost::crc_32_type crc32_calc_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::PowerBoard>(
        goby::middleware::ProtobufConfigurator<config::PowerBoardConfig>(argc, argv));
}

// Main thread
jaiabot::apps::PowerBoard::PowerBoard()
    : zeromq::MultiThreadApplication<config::PowerBoardConfig>(1.0 / 30.0 * si::hertz)
{
    using MCUSerialThread =
        goby::middleware::io::SerialThreadCOBS<power_board_serial_in, power_board_serial_out,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD>;

    // receive data from MCU
    interthread().subscribe<power_board_serial_in>(
        [this](const goby::middleware::protobuf::IOData& io_msg) { receive_from_mcu(io_msg); });

    // send requests from driver threads
    interthread().subscribe<jaiabot::groups::power_board_pb_data_out>(
        [this](const jaiabot::protobuf::PowerBoardRequest& request) { send_to_mcu(request); });

    interprocess().subscribe<jaiabot::groups::power_board_command>(
        [this](const jaiabot::protobuf::PowerBoardRequest& request) { send_to_mcu(request); });

    launch_thread<MCUSerialThread>(cfg().power_board_serial());
}

void jaiabot::apps::PowerBoard::loop()
{
    query_metadata();
}

void jaiabot::apps::PowerBoard::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
}

void jaiabot::apps::PowerBoard::query_metadata()
{
    jaiabot::protobuf::PowerBoardRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    request.set_request_metadata(true);
    send_to_mcu(request);
}

void jaiabot::apps::PowerBoard::send_to_mcu(const jaiabot::protobuf::PowerBoardRequest& request)
{
    glog.is_verbose() && glog << "Send data to MCU: " << request.ShortDebugString() << std::endl;

    auto io_msg = std::make_shared<goby::middleware::protobuf::IOData>();
    std::string* encoded = io_msg->mutable_data();
    request.SerializeToString(encoded);

    uint32_t crc32_value = crc::calculate_crc32(encoded->data(), encoded->size());

    constexpr int bits_in_byte = 8;
    constexpr int bytes_in_crc32 = 4;

    for (int i = bytes_in_crc32 - 1; i >= 0; --i)
    { encoded->push_back((crc32_value >> (i * bits_in_byte)) & 0xFF); }

    glog.is_debug1() && glog << "Sending bytes to MCU: " << goby::util::hex_encode(io_msg->data())
                             << std::endl;

    interthread().publish<power_board_serial_out>(io_msg);
}

void jaiabot::apps::PowerBoard::receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg)
{
    constexpr int bits_in_byte = 8;
    constexpr int bytes_in_crc32 = 4;

    try
    {
        glog.is_debug1() && glog << "Received bytes from MCU: "
                                 << goby::util::hex_encode(io_msg.data()) << std::endl;

        const auto& encoded = io_msg.data();

        if (encoded.size() < bytes_in_crc32)
            throw(std::runtime_error("Message is too small"));

        uint32_t computed_crc =
            crc::calculate_crc32(encoded.data(), encoded.size() - bytes_in_crc32);
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

        jaiabot::protobuf::PowerBoardMessage power_board_msg;
        power_board_msg.ParseFromArray(encoded.data(), encoded.size() - bytes_in_crc32);

        glog.is_verbose() && glog << "Received data from MCU: "
                                  << power_board_msg.ShortDebugString() << std::endl;

        // publish for appropriate thread and for logging
        interprocess().publish<jaiabot::groups::power_board_pb_data_in>(power_board_msg);

        if (power_board_msg.has_metadata())
            receive_metadata_from_mcu(power_board_msg.metadata());
    }
    catch (std::exception& e)
    {
        glog.is_warn() && glog << "Failed to decode message from MCU: " << e.what() << std::endl;
    }
}

void jaiabot::apps::PowerBoard::receive_metadata_from_mcu(
    const jaiabot::protobuf::Metadata& metadata)
{
    if (metadata.init_failed())
    {
        glog.is_warn() && glog << "Power board initialization failed: "
                               << metadata.ShortDebugString() << std::endl;
        return;
    }

    if (metadata.has_power_board_version())
    {
        glog.is_verbose() && glog << "Power Board Software Version: "
                                  << metadata.power_board_version() << std::endl;
    }
}
