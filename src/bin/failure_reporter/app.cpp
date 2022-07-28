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
#include "jaiabot/messages/health.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::FailureReporter>;

namespace jaiabot
{
namespace apps
{
class FailureReporter : public ApplicationBase
{
  public:
    FailureReporter();

  private:
    void loop() override;

    void send_report();

  private:
    int attempts_{0};
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::FailureReporter>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::FailureReporter>(argc, argv));
}

jaiabot::apps::FailureReporter::FailureReporter() : ApplicationBase(0.5 * boost::units::si::hertz)
{
    interprocess().subscribe<groups::systemd_report_ack>(
        [this](const protobuf::SystemdReportAck& ack) {
            if (ack.error_ack() == cfg().error_code())
            {
                glog.is_debug1() && glog << "Got ack. quitting" << std::endl;
                quit();
            }
        });

    send_report();
}

void jaiabot::apps::FailureReporter::loop() { send_report(); }

void jaiabot::apps::FailureReporter::send_report()
{
    auto error = cfg().error_code();

    switch (cfg().state())
    {
        case config::FailureReporter::START:
        {
            protobuf::SystemdStartReport report;
            report.set_clear_error(error);
            interprocess().publish<groups::systemd_report>(report);
            break;
        }
        case config::FailureReporter::STOP:
        {
            std::string result_enum_string = "SERVICE_RESULT_" + cfg().service_result();
            boost::to_upper(result_enum_string);
            boost::replace_all(result_enum_string, "-", "_");
            protobuf::SystemdStopReport::ServiceResult result;
            if (!protobuf::SystemdStopReport::ServiceResult_Parse(result_enum_string, &result))
                result = protobuf::SystemdStopReport::SERVICE_RESULT_UNKNOWN;

            protobuf::SystemdStopReport report;
            report.set_result(result);
            if (result != protobuf::SystemdStopReport::SERVICE_RESULT_SUCCESS)
            {
                report.set_error(error);
                report.set_journal_dump_file(cfg().log_dir() + "/" + cfg().service_name() + "_" +
                                             goby::time::file_str() + ".error");
                // write journal since last boot to a file
                std::string journalctl_cmd = "/usr/bin/journalctl -b -0 -o short-full -u " +
                                             cfg().service_name() + " > " +
                                             report.journal_dump_file();
                system(journalctl_cmd.c_str());

                // only publish failures
                interprocess().publish<groups::systemd_report>(report);
            }
            else
            {
                quit();
            }

            break;
        }
    }

    ++attempts_;
    if (attempts_ >= cfg().num_attempts())
    {
        glog.is_warn() && glog << "No ack after " << attempts_ << " attempts. quitting."
                               << std::endl;
        quit();
    }
}
