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
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/example.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
class MultiThreadPattern : public zeromq::MultiThreadApplication<config::MultiThreadPattern>
{
  public:
    MultiThreadPattern();

  private:
    void timer0();
    void loop() override;
};

class SubThreadA : public middleware::SimpleThread<config::MultiThreadPattern>
{
  public:
    SubThreadA(const config::MultiThreadPattern& config);

  private:
    void loop() override;
};

class SubThreadB : public middleware::SimpleThread<config::MultiThreadPattern>
{
  public:
    SubThreadB(const config::MultiThreadPattern& config);

  private:
    void loop() override;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::MultiThreadPattern>(
        goby::middleware::ProtobufConfigurator<config::MultiThreadPattern>(argc, argv));
}

// Main thread

jaiabot::apps::MultiThreadPattern::MultiThreadPattern()
    : zeromq::MultiThreadApplication<config::MultiThreadPattern>(10 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    // launch our child threads
    launch_thread<SubThreadA>(cfg());
    launch_thread<SubThreadB>(cfg());

    // create a separate timer that goes off every 10 seconds
    launch_thread<middleware::TimerThread<0>>(0.1 * si::hertz);
    interthread().subscribe_empty<middleware::TimerThread<0>::expire_group>(
        std::bind(&MultiThreadPattern::timer0, this));
}

void jaiabot::apps::MultiThreadPattern::loop()
{
    // called at frequency passed to MultiThreadApplication base class
    glog.is_verbose() && glog << group("main") << "Loop!" << std::endl;

    jaiabot::protobuf::Example example_msg;
    example_msg.set_b(5);
    interprocess().publish<groups::example>(example_msg);
}

void jaiabot::apps::MultiThreadPattern::timer0()
{
    glog.is_verbose() && glog << "Timer0" << std::endl;
}

// Subthread A
jaiabot::apps::SubThreadA::SubThreadA(const config::MultiThreadPattern& config)
    : middleware::SimpleThread<config::MultiThreadPattern>(config, 2.0 * si::hertz)
{
    glog.add_group("a", goby::util::Colors::blue);
}

void jaiabot::apps::SubThreadA::loop()
{
    // called at frequency passed to middleware::SimpleThread base class
    glog.is_verbose() && glog << group("a") << "Loop!" << std::endl;
}

// Subthread B
jaiabot::apps::SubThreadB::SubThreadB(const config::MultiThreadPattern& config)
    : middleware::SimpleThread<config::MultiThreadPattern>(config, 1.0 * si::hertz)
{
    glog.add_group("b", goby::util::Colors::magenta);
}

void jaiabot::apps::SubThreadB::loop()
{
    glog.is_verbose() && glog << group("b") << "Loop!" << std::endl;
}
