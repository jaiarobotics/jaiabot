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
#include <chrono>
#include <format>
#include <string>


std::string now_timestamp() {
    using namespace std::chrono;

    auto now = system_clock::now();
    return std::format("{:%Y%m%dT%H%M%S}", floor<seconds>(now));
}


pid_t start_logging_ppk_to_file(const std::string& ubx_output_filename) {
    pid_t pid = fork();
    if (pid == -1) {
        std::cerr << "fork failed: " << std::strerror(errno) << "\n";
        return -1;
    }

    if (pid == 0) {
        // Child
        const char* argv[] = {
            "ubxtool",
            "-R", ubx_output_filename.c_str(),
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
    string ubx_output_filename_prefix_;
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

    ubx_output_filename_prefix_ = cfg().ubx_output_dir() + "/" +
                                  "bot" + std::to_string(cfg().bot_id()) + "_" +
                                  "fleet" + std::to_string(cfg().fleet_id()) + "_ppk_";

    interprocess().subscribe<jaiabot::groups::ppk>(
        [this](const jaiabot::protobuf::PPKCommand& command) {
            glog.is_warn() && glog << "Received PPK command: " << command.ShortDebugString() << std::endl;

            switch(command.type()) {
                case jaiabot::protobuf::PPKCommand_IMUCommandType_START_RECORDING:
                    ppk_process_pid_ = start_logging_ppk_to_file(ubx_output_filename_prefix_ + now_timestamp() + ".ubx");
                    break;
                case jaiabot::protobuf::PPKCommand_IMUCommandType_STOP_RECORDING:
                    kill_process(ppk_process_pid_);
                    ppk_process_pid_ = -1;
                    break;
                default:
                    glog.is_warn() && glog << "Received unknown PPK command type: " << command.type() << std::endl;
                    break;
            }
        });

    glog.is_warn() && glog << "PPK application initialized, subscribed to PPK commands." << std::endl;

}

void jaiabot::apps::PKK::loop() {}
