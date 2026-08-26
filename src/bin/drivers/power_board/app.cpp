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
#include "jaiabot/messages/power_board/power_board.pb.h"
#include "jaiabot/messages/control_surfaces.pb.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/low_control.pb.h"

#define now_microseconds() (goby::time::SystemClock::now<goby::time::MicroTime>().value())

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
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);
    int calculateMotorMicroseconds(const int& input);
    int surfaceValueToMicroseconds(int input, int lower, int center, int upper);
    void handle_control_surfaces(const jaiabot::protobuf::ControlSurfaces& control_surfaces);

  private:
    int64_t lastAckTime_;
    boost::crc_32_type crc32_calc_;
    jaiabot::protobuf::Bounds bounds_;

    goby::time::SteadyClock::time_point last_report_time_{goby::time::SteadyClock::now()};

    uint64_t _time_last_command_received_ = 0;
    bool led_switch_on = true;
    bool bot_rolled_over_{false};
    bool last_command_acked_{true};
    const uint64_t timeout_ = 5e6;
    int power_board_timeout_ = 5;

    // Motor
    int target_motor_ = 1500;
    int max_reverse_ = 1320;
    int motor_off_ = 1500;

    // Control surfaces
    int rudder_ = 1500;
    int port_elevator_ = 1500;
    int stbd_elevator_ = 1500;
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

    interprocess().subscribe<jaiabot::groups::low_control>(
        [this](const jaiabot::protobuf::LowControl& low_control) { handle_control_surfaces(low_control.control_surfaces()); });

    launch_thread<MCUSerialThread>(cfg().power_board_serial());
}

void jaiabot::apps::PowerBoard::loop()
{
    query_metadata();

    // Toggle LED at ~1 Hz to verify command receiver/handler on power board
    static int loop_count = 0;
    constexpr int loops_per_second = 30; // loop() runs at 30 Hz
    if (++loop_count >= loops_per_second)
    {
        loop_count = 0;
        led_switch_on = !led_switch_on;

        jaiabot::protobuf::PowerBoardRequest request;
        request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        auto* cs = request.mutable_control_surfaces();
        cs->set_motor(target_motor_);
        cs->set_rudder(rudder_);
        cs->set_port_elevator(port_elevator_);
        cs->set_stbd_elevator(stbd_elevator_);
        cs->set_timeout(power_board_timeout_);
        cs->set_led_switch_on(led_switch_on);
        send_to_mcu(request);
        glog.is_verbose() && glog << "LED toggle: " << (led_switch_on ? "ON" : "OFF") << std::endl;
    }
}

void jaiabot::apps::PowerBoard::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    check_last_report(health, health_state);

    health.set_state(health_state);
}

void jaiabot::apps::PowerBoard::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_report_time_ + std::chrono::seconds(cfg().power_board_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on power board report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__MISSING_DATA__POWER_BOARD_REPORT);
    }
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

        jaiabot::protobuf::PowerBoardResponse power_board_msg;
        power_board_msg.ParseFromArray(encoded.data(), encoded.size() - bytes_in_crc32);

        last_report_time_ = goby::time::SteadyClock::now();

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

int jaiabot::apps::PowerBoard::surfaceValueToMicroseconds(int input, int lower, int center,
                                                          int upper)
{
    double microseconds = 0.0;

    if (bot_rolled_over_)
    {
        input = input * -1;
    }

    if (input > 0)
    {
        microseconds = center + (input / 100.0) * (upper - center);
    }
    else
    { 
        microseconds = center + (input / 100.0) * (center - lower);
    }

    return microseconds;
}

/**
 * @brief Converts motor percentage to microseconds
 * 
 * @param input Throttle percentage
 * @return int Microseconds for the ESC to take in
 */
int jaiabot::apps::PowerBoard::calculateMotorMicroseconds(const int& input)
{
    return motor_off_ + (input / 100.0) * 400;
}

void jaiabot::apps::PowerBoard::handle_control_surfaces(const jaiabot::protobuf::ControlSurfaces& control_surfaces)
{
    jaiabot::protobuf::PowerBoardRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    if (control_surfaces.has_motor())
    {
        target_motor_ = calculateMotorMicroseconds(control_surfaces.motor());

        // Do not go lower than max_reverse
        if (target_motor_ < max_reverse_)
        {
            target_motor_ = max_reverse_;
        }
    }

    if (control_surfaces.has_rudder())
    {
        rudder_ = surfaceValueToMicroseconds(control_surfaces.rudder(), bounds_.rudder().lower(),
                                             bounds_.rudder().center(), bounds_.rudder().upper());
    }

    if (control_surfaces.has_stbd_elevator())
    {
        stbd_elevator_ =
            surfaceValueToMicroseconds(control_surfaces.stbd_elevator(), bounds_.strb().lower(),
                                       bounds_.strb().center(), bounds_.strb().upper());
    }

    if (control_surfaces.has_port_elevator())
    {
        port_elevator_ =
            surfaceValueToMicroseconds(control_surfaces.port_elevator(), bounds_.port().lower(),
                                       bounds_.port().center(), bounds_.port().upper());
    }

    if (control_surfaces.has_timeout())
    {
        power_board_timeout_ = control_surfaces.timeout();
    }

    // Mirror LED state from incoming control message when provided.
    if (control_surfaces.has_led_switch_on())
    {
        led_switch_on = control_surfaces.led_switch_on();
    }

    auto* cs = request.mutable_control_surfaces();
    cs->set_motor(target_motor_);
    cs->set_rudder(rudder_);
    cs->set_stbd_elevator(stbd_elevator_);
    cs->set_port_elevator(port_elevator_);
    cs->set_timeout(power_board_timeout_);
    cs->set_led_switch_on(led_switch_on);

    _time_last_command_received_ = now_microseconds();

    send_to_mcu(request);
}