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
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/feather.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group bar30{"bar30"};

namespace jaiabot
{
namespace apps
{
class Bar30Test : public zeromq::MultiThreadApplication<config::Bar30Test>
{
  public:
    Bar30Test();

  private:
    void loop() override;

  private:
    dccl::Codec dccl_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Bar30Test>(
        goby::middleware::ProtobufConfigurator<config::Bar30Test>(argc, argv));
}

// Main thread

double loop_freq = 1;

jaiabot::apps::Bar30Test::Bar30Test()
    : zeromq::MultiThreadApplication<config::Bar30Test>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("bar30_test", goby::util::Colors::lt_magenta);
}

void jaiabot::apps::Bar30Test::loop()
{
    glog.is_verbose() && glog << group("bar30_test") << "Bar 30 path: " << cfg().input_file_path() << std::endl;
}

/*void jaiabot::apps::Bar30Test::send_msg(const jaiabot::protobuf::LoRaMessage& pb_msg)
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

    interprocess().publish<groups::lora_tx>(pb_msg);
}
*/

