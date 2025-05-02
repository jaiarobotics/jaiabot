// Copyright 2025:
//   JaiaRoboticsLLC
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

#include "jaiabot/messages/fleet_config.pb.h"

#include <goby/util/debug_logger.h>

namespace jaiabot
{
namespace apps
{
namespace tool
{
inline jaiabot::protobuf::FleetConfig
parse_fleet_config_from_file(const std::string& fleet_cfg_file)
{
    jaiabot::protobuf::FleetConfig fleet_cfg;
    std::ifstream file(fleet_cfg_file);
    if (!file.is_open())
    {
        goby::glog.is_die() && goby::glog << "Failed to open file: " << fleet_cfg_file << std::endl;
    }

    // Read the entire file into a string
    std::string file_content((std::istreambuf_iterator<char>(file)),
                             std::istreambuf_iterator<char>());

    // Parse the text format protobuf
    if (!google::protobuf::TextFormat::ParseFromString(file_content, &fleet_cfg))
    {
        goby::glog.is_die() && goby::glog << "Failed to parse protobuf text format from file: "
                                          << fleet_cfg_file << std::endl;
    }
    return fleet_cfg;
}

} // namespace tool
} // namespace apps
} // namespace jaiabot
