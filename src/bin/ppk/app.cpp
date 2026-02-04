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
#include <filesystem>


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

    void start_logging();
    void stop_logging();

    pid_t ppk_process_pid_{-1};
    size_t logged_bytes_{0};
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
    : zeromq::SingleThreadApplication<PKKConfig>(1.0 * boost::units::si::hertz)
{

    interprocess().subscribe<jaiabot::groups::ppk>(
        [this](const jaiabot::protobuf::PPKCommand& command) {
            glog.is_warn() && glog << "Received PPK command: " << command.ShortDebugString() << std::endl;

            switch(command.type()) {
                case jaiabot::protobuf::PPKCommand_PPKCommandType_START_RECORDING:
                    start_logging();
                    break;
                case jaiabot::protobuf::PPKCommand_PPKCommandType_STOP_RECORDING:
                    stop_logging();
                    break;
                default:
                    glog.is_warn() && glog << "Received unknown PPK command type: " << command.type() << std::endl;
                    break;
            }
        });

    glog.is_warn() && glog << "PPK application initialized, subscribed to PPK commands." << std::endl;

}

void jaiabot::apps::PKK::loop() {
    // Read new UBX bytes, and publish them
    std::ifstream file(cfg().ubx_output_filename(), std::ios::binary);
    if (!file) {
        return; // file not found yet
    }

    // Determine file size
    file.seekg(0, std::ios::end);
    std::streamoff end = file.tellg();

    if (logged_bytes_ < 0 || logged_bytes_ > end) {
        glog.is_warn() && glog << "UBX file was truncated or reset, resetting logged_bytes_ to 0." << std::endl;
        logged_bytes_ = 0;
        return;
    }

    // Seek to requested offset
    file.seekg(logged_bytes_, std::ios::beg);
    std::vector<uint8_t> buffer(static_cast<size_t>(end - logged_bytes_));

    file.read(reinterpret_cast<char*>(buffer.data()), buffer.size());

    if (!file) {
        glog.is_warn() && glog << "Error reading UBX file: " << std::strerror(errno) << std::endl;
        return;
    }

    // Publish the data
    if (buffer.empty()) {
        return; // no new data
    }

    jaiabot::protobuf::UBXChunk ubx_chunk;
    ubx_chunk.set_data(std::string(reinterpret_cast<const char*>(buffer.data()), buffer.size()));
    interprocess().publish<jaiabot::groups::ppk>(ubx_chunk);

    logged_bytes_ += buffer.size();
}


void jaiabot::apps::PKK::start_logging() {
    if (ppk_process_pid_ > 0) {
        glog.is_warn() && glog << "PPK logging process already running with PID " << ppk_process_pid_ << std::endl;
        return;
    }

    pid_t pid = fork();
    if (pid == -1) {
        glog.is_warn() && glog << "fork failed: " << std::strerror(errno) << std::endl;
        return;
    }

    if (pid == 0) {
        // Child
        const char* argv[] = {
            "/usr/bin/python3",
            "/usr/bin/ubxtool",
            "-R", cfg().ubx_output_filename().c_str(),
            "-w", "0",
            nullptr
        };

        execvp(argv[0], const_cast<char* const*>(argv));
        glog.is_warn() && glog << "execvp failed: " << std::strerror(errno) << std::endl;
        _exit(127); // exec failed
    }

    // Parent
    ppk_process_pid_ = pid;
    logged_bytes_ = 0;
    glog.is_verbose() && glog << "Started PPK logging process with PID " << ppk_process_pid_ << std::endl;
    return;
}


void jaiabot::apps::PKK::stop_logging() {
    if (ppk_process_pid_ <= 0) {
        glog.is_warn() && glog << "No PPK logging process running." << std::endl;
        return;
    }
    
    glog.is_verbose() && glog << "Stopping PPK logging process with PID " << ppk_process_pid_ << std::endl;
    if (kill(ppk_process_pid_, SIGTERM) == 0) {
        sleep(1); // give it a moment to exit

        // Check if process is still running
        if (kill(ppk_process_pid_, 0) != 0) {
            glog.is_verbose() && glog << "Success." << std::endl;
            ppk_process_pid_ = -1;
            std::filesystem::remove(cfg().ubx_output_filename());
            return;
        }
    }

    if (errno == ESRCH) {
        glog.is_verbose() && glog << "PPK logging process has already exited." << std::endl;
        ppk_process_pid_ = -1;
        std::filesystem::remove(cfg().ubx_output_filename());
        return;
    }

    glog.is_warn() && glog << "PPK logging process " <<  ppk_process_pid_ << " did not terminate after SIGTERM, sending SIGKILL." << std::endl;

    kill(ppk_process_pid_, SIGKILL);
    ppk_process_pid_ = -1;
    std::filesystem::remove(cfg().ubx_output_filename());
    return;

}
