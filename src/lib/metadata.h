// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_SRC_LIB_METADATA_H
#define JAIABOT_SRC_LIB_METADATA_H

#include <fstream>
#include <iostream>
#include <regex>

#include <boost/algorithm/string.hpp>

#include <goby/version.h>

#include "jaiabot/messages/metadata.pb.h"
#include "jaiabot/version.h"

namespace jaiabot
{
inline protobuf::DeviceMetadata metadata()
{
    protobuf::DeviceMetadata metadata;

    auto jaia_name_c = getenv("JAIA_DEVICE_NAME");
    std::string jaia_device_name;
    if (jaia_name_c)
    {
        jaia_device_name = std::string(jaia_name_c);
    }
    else
    {
        char buffer[256];
        if (gethostname(buffer, 256) == 0)
        {
            jaia_device_name = std::string(buffer);
        }
        else
        {
            jaia_device_name = "<No Name>";
        }
    }

    metadata.set_name(jaia_device_name);
    auto& jaiabot_version = *metadata.mutable_jaiabot_version();
    jaiabot_version.set_major(JAIABOT_VERSION_MAJOR);
    jaiabot_version.set_minor(JAIABOT_VERSION_MINOR);
    jaiabot_version.set_patch(JAIABOT_VERSION_PATCH);

#ifdef JAIABOT_VERSION_GITHASH
    jaiabot_version.set_git_hash(JAIABOT_VERSION_GITHASH);
    jaiabot_version.set_git_branch(JAIABOT_VERSION_GITBRANCH);
#endif

    auto execute_command = [](const char* cmd) -> std::string
    {
        std::array<char, 128> buffer;
        std::string result;
        std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(cmd, "r"), pclose);
        if (!pipe)
        {
            throw std::runtime_error("popen() failed!");
        }
        while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr)
        {
            result += buffer.data();
        }
        return result;
    };

    std::string cmd = "apt-cache policy jaiabot-embedded";
    std::string output = execute_command(cmd.c_str());

    std::regex installed_pattern(R"(Installed: (\S+))");
    std::smatch installed_match;
    if (std::regex_search(output, installed_match, installed_pattern))
    {
        std::string installed_version = installed_match[1];

        if (installed_version != "(none)")
        {
            // Perform regex match to extract "repo" and "release_branch"
            std::regex repo_pattern(R"(packages\.jaia\.tech/ubuntu/([a-z]*)/([X0-9]+\.y*))");
            std::smatch repo_match;
            if (std::regex_search(output, repo_match, repo_pattern))
            {
                std::string repo = repo_match[1];
                std::string release_branch = repo_match[2];

                jaiabot_version.set_deb_repository(repo);
                jaiabot_version.set_deb_release_branch(release_branch);
            }
        }
    }

    metadata.set_goby_version(goby::VERSION_STRING);
    metadata.set_moos_version(MOOS_VERSION);

    std::ifstream image_version_file("/etc/jaiabot/version");
    if (image_version_file.is_open())
    {
        std::string line;
        std::map<std::string, std::string> version_info;

        while (std::getline(image_version_file, line))
        {
            auto equal_pos = line.find('=');
            if (equal_pos == std::string::npos)
                continue;

            std::string value = line.substr(equal_pos + 1);
            boost::trim_if(value, boost::is_any_of("\""));
            version_info[line.substr(0, equal_pos)] = value;
        }
        if (version_info.count("JAIABOT_IMAGE_VERSION"))
            metadata.set_jaiabot_image_version(version_info["JAIABOT_IMAGE_VERSION"]);
        if (version_info.count("RASPI_FIRMWARE_VERSION"))
            metadata.set_raspi_firmware_version(version_info["RASPI_FIRMWARE_VERSION"]);
        if (version_info.count("JAIABOT_IMAGE_BUILD_DATE"))
            metadata.set_jaiabot_image_build_date(version_info["JAIABOT_IMAGE_BUILD_DATE"]);
        if (version_info.count("JAIABOT_FIRST_BOOT_DATE"))
            metadata.set_jaiabot_image_first_boot_date(version_info["JAIABOT_FIRST_BOOT_DATE"]);
    }

    return metadata;
}

} // namespace jaiabot

#endif
