// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
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

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/application/multi_thread.h>
#include <goby/middleware/io/line_based/serial.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/feather.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group serial_in{"serial_in"};
constexpr goby::middleware::Group serial_out{"serial_out"};

namespace jaiabot
{
namespace apps
{
class LoRaTest : public middleware::MultiThreadStandaloneApplication<config::LoRaTest>
{
  public:
    LoRaTest();

  private:
    void loop() override;
    void set_parameters();
    void send_msg(const jaiabot::protobuf::LoRaMessage& pb_msg);

  private:
    std::uint8_t test_index_ = 0;
    std::deque<std::uint8_t> test_data_;

    bool feather_initialized_{false};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::LoRaTest>(
        goby::middleware::ProtobufConfigurator<config::LoRaTest>(argc, argv));
}

// Main thread

jaiabot::apps::LoRaTest::LoRaTest()
    : middleware::MultiThreadStandaloneApplication<config::LoRaTest>(.1 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;

    launch_thread<SerialThread>(cfg().serial());

    interthread().subscribe<serial_in>([this](const goby::middleware::protobuf::IOData& io) {
        auto& data = io.data();
        jaiabot::protobuf::LoRaMessage pb_msg;
        constexpr auto prefix_size = jaiabot::lora::SERIAL_MAGIC_BYTES + jaiabot::lora::SIZE_BYTES;
        pb_msg.ParseFromArray(&data[0] + prefix_size, data.size() - prefix_size);

        glog.is_verbose() && glog << group("main") << "Received: " << pb_msg.ShortDebugString()
                                  << std::endl;

        switch (pb_msg.type())
        {
            default: break;
            case jaiabot::protobuf::LoRaMessage::LORA_DATA: break;
            case jaiabot::protobuf::LoRaMessage::FEATHER_READY:
                if (!feather_initialized_)
                    set_parameters();
                break;
            case jaiabot::protobuf::LoRaMessage::PARAMETERS_ACCEPTED:
                feather_initialized_ = true;
                break;
        }
    });

    for (; test_index_ < cfg().message_length(); ++test_index_) test_data_.push_back(test_index_);

    set_parameters();
}

void jaiabot::apps::LoRaTest::loop()
{
    if (!feather_initialized_)
        set_parameters();

    static int loop_index = 0;
    if (cfg().transmit() && ((loop_index % cfg().num_vehicles()) + 1 == cfg().src()))
    {
        test_data_.pop_front();
        test_data_.push_back(test_index_++);

        jaiabot::protobuf::LoRaMessage pb_msg;
        pb_msg.set_src(cfg().src());
        pb_msg.set_dest(cfg().dest());
        pb_msg.set_data(std::string(test_data_.begin(), test_data_.end()));
        pb_msg.set_type(jaiabot::protobuf::LoRaMessage::LORA_DATA);
        send_msg(pb_msg);
    }
    ++loop_index;
}

void jaiabot::apps::LoRaTest::set_parameters()
{
    jaiabot::protobuf::LoRaMessage pb_msg;
    pb_msg.set_src(cfg().src());
    pb_msg.set_dest(cfg().src());
    pb_msg.set_type(jaiabot::protobuf::LoRaMessage::SET_PARAMETERS);
    pb_msg.set_data("");

    send_msg(pb_msg);
}

void jaiabot::apps::LoRaTest::send_msg(const jaiabot::protobuf::LoRaMessage& pb_msg)
{
    auto io = std::make_shared<goby::middleware::protobuf::IOData>();

    glog.is_verbose() && glog << group("main") << "Sending: " << pb_msg.ShortDebugString()
                              << std::endl;

    std::string pb_encoded = pb_msg.SerializeAsString();

    std::uint16_t size = pb_encoded.size();
    std::string size_str = {static_cast<char>((size >> jaiabot::lora::BITS_IN_BYTE) & 0xFF),
                            static_cast<char>(size & 0xFF)};

    io->set_data(jaiabot::lora::SERIAL_MAGIC + size_str + pb_encoded);
    interthread().publish<serial_out>(io);
}
