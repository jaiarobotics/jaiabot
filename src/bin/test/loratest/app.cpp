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

  private:
    std::uint8_t test_index_ = 0;
    std::deque<std::uint8_t> test_data_;

    constexpr static int RH_RF95_MAX_MESSAGE_LEN{5};
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
    : middleware::MultiThreadStandaloneApplication<config::LoRaTest>(1.0 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using SerialThread = goby::middleware::io::SerialThreadLineBased<serial_in, serial_out>;

    launch_thread<SerialThread>(cfg().serial());

    interthread().subscribe<serial_in>([this](const goby::middleware::protobuf::IOData& io) {
        glog.is_verbose() && glog << io.DebugString() << std::flush;
    });

    for (; test_index_ < RH_RF95_MAX_MESSAGE_LEN; ++test_index_) test_data_.push_back(test_index_);
}

void jaiabot::apps::LoRaTest::loop()
{
    if (cfg().transmit())
    {
        test_data_.pop_front();
        test_data_.push_back(test_index_++);

        auto io = std::make_shared<goby::middleware::protobuf::IOData>();
        jaiabot::protobuf::LoRaMessage pb_msg;
        pb_msg.set_src(cfg().src());
        pb_msg.set_dest(cfg().dest());
        pb_msg.set_data(std::string(test_data_.begin(), test_data_.end()));

        std::string pb_encoded = pb_msg.SerializeAsString();
        std::string b64_pb_encoded = dccl::b64_encode(pb_encoded);
        boost::erase_all(b64_pb_encoded, "\n");

        glog.is_verbose() && glog << "Size: " << pb_encoded.size()
                                  << ", after b64: " << b64_pb_encoded.size() << std::endl;

        io->set_data("P:" + b64_pb_encoded + "\n");
        interthread().publish<serial_out>(io);
    }
}
