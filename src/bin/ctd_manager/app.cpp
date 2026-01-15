// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Michael Twomey <michael.twomey@jaia.tech>
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
#include <fstream>
#include <string>

#include "config.pb.h"
#include "jaiabot/messages/ctd.pb.h"
#include "jaiabot/groups.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase =
    goby::zeromq::SingleThreadApplication<jaiabot::config::CTDManager>;

namespace jaiabot
{
namespace apps
{
class CTDManager : public ApplicationBase
{
  public:
    CTDManager();
  private:
    void handle_ctd_profile(const jaiabot::protobuf::CTDProfile& ctd_profile);
    void write_to_file(const std::string& path, const std::string& content);

};
} // namespace apps
} // namespace jaiabot

jaiabot::apps::CTDManager::CTDManager() : ApplicationBase() {
  interprocess().subscribe<jaiabot::groups::ctd>(
    [this](const jaiabot::protobuf::CTDProfile& ctd_profile) {
      glog.is_debug1() && glog << "Received CTD Profile" << std::endl;
      handle_ctd_profile(ctd_profile);
    }
  );
}

void jaiabot::apps::CTDManager::handle_ctd_profile(const jaiabot::protobuf::CTDProfile& ctd_profile) {
  write_to_file("/var/log/jaiabot/test.txt", ctd_profile.ShortDebugString());
}

void jaiabot::apps::CTDManager::write_to_file(const std::string& path, const std::string& content)
{
  std::ofstream out(path);
  out << content;
  out.close();
}

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::CTDManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::CTDManager>(argc, argv));
}
