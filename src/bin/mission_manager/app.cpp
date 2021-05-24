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
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/example.pb.h"
#include "machine.h"

using goby::glog;
namespace si = boost::units::si;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
class MissionManager : public zeromq::MultiThreadApplication<config::MissionManager>
{
  public:
    MissionManager();

  private:
    void initialize() override
    {
        machine_.reset(new statechart::MissionManagerStateMachine(*this));
        machine_->initiate();
    }

    void finalize() override
    {
        machine_->terminate();
        machine_.reset();
    }

    template <typename State>
    friend void statechart::publish_entry(State& state, const std::string& name);
    template <typename State>
    friend void statechart::publish_exit(State& state, const std::string& name);

  private:
    std::unique_ptr<statechart::MissionManagerStateMachine> machine_;
    std::string current_state_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::MissionManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::MissionManager>(argc, argv));
}

// Main thread

jaiabot::apps::MissionManager::MissionManager()
    : zeromq::MultiThreadApplication<config::MissionManager>(1 * si::hertz)
{
    interthread().subscribe<groups::state_entry>([this](const std::string& state_name) {
        glog.is_verbose() && glog << group("main") << "Entered: " << state_name << std::endl;
        current_state_ = state_name;
    });

    interthread().subscribe<groups::state_exit>([](const std::string& state_name) {
        glog.is_verbose() && glog << group("main") << "Exited: " << state_name << std::endl;
    });
}
