// Copyright 2021:
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

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/example.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase =
    goby::zeromq::SingleThreadApplication<jaiabot::config::SingleThreadPattern>;

namespace jaiabot
{
namespace apps
{
class SingleThreadPattern : public ApplicationBase
{
  public:
    SingleThreadPattern() : ApplicationBase(1.0 / (10.0 * si::seconds)) {}

  private:
    void loop() override;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::SingleThreadPattern>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::SingleThreadPattern>(argc,
                                                                                          argv));
}

void jaiabot::apps::SingleThreadPattern::loop()
{
    // called at frequency passed to SingleThreadApplication (ApplicationBase)
    glog.is_verbose() && glog << "Loop!" << std::endl;
}
