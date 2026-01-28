// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

// This application listens for a command to start / stop logging the raw PPK data.

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>
using goby::glog;

using namespace std;

#include "jaiabot/messages/ppk.pb.h"

#include "bin/ppk/config.pb.h"
using namespace jaiabot::config;

#include "jaiabot/groups.h"

namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;


#include <unistd.h>
#include <sys/types.h>
#include <cerrno>
#include <cstring>
#include <iostream>

pid_t start_process() {
    pid_t pid = fork();
    if (pid == -1) {
        std::cerr << "fork failed: " << std::strerror(errno) << "\n";
        return -1;
    }

    if (pid == 0) {
        // Child
        const char* argv[] = {
            "ubxtool",
            "-R", "/var/log/jaiabot/ppk_raw.ubx",
            "-w", "0",
            nullptr
        };

        execvp(argv[0], const_cast<char* const*>(argv));
        _exit(127); // exec failed
    }

    // Parent
    return pid;
}


bool kill_process(pid_t pid) {
    if (pid <= 0) return false;
    return kill(pid, SIGTERM) == 0;
}


namespace jaiabot
{
namespace apps
{
class PKK : public zeromq::SingleThreadApplication<PKKConfig>
{
  public:
    PKK();

  private:
    void loop() override;

    pid_t ppk_process_pid_{-1};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::PKK>(
        goby::middleware::ProtobufConfigurator<PKKConfig>(argc, argv));
}

// Main thread

jaiabot::apps::PKK::PKK()
    : zeromq::SingleThreadApplication<PKKConfig>(0.0 * boost::units::si::hertz)
{

    interprocess().subscribe<jaiabot::groups::ppk>(
        [this](const jaiabot::protobuf::PPKCommand& command) {
            glog.is_warn() && glog << "Received PPK command of type " << command.type();

            switch(command.type()) {
                case jaiabot::protobuf::PPKCommand_IMUCommandType_START_RECORDING:
                    ppk_process_pid_ = start_process();
                case jaiabot::protobuf::PPKCommand_IMUCommandType_STOP_RECORDING:
                    kill_process(ppk_process_pid_);
                default:
                    glog.is_warn() && glog << "Received unknown PPK command type: " << command.type();
            }
        });

}

void jaiabot::apps::PKK::loop() {}
