#include <google/protobuf/util/json_util.h>

#include "goby/middleware/application/tool.h"

#include "jaiabot/metadata.h"
#include "version.h"

jaiabot::apps::VersionTool::VersionTool()
{
    jaiabot::protobuf::DeviceMetadata all_pb_metadata = jaiabot::metadata();
    jaiabot::protobuf::DeviceMetadata display_pb_metadata;

    for (auto version : app_cfg().display_version())
    {
        switch (version)
        {
            case jaiabot::config::VersionTool::jaiabot:
                *display_pb_metadata.mutable_jaiabot_version() = all_pb_metadata.jaiabot_version();
                if (app_cfg().format() == jaiabot::config::VersionTool::text)
                {
                    std::cout << "jaiabot:" << std::endl;
                    std::cout << "  " << all_pb_metadata.jaiabot_version().major() << "."
                              << all_pb_metadata.jaiabot_version().minor() << "."
                              << all_pb_metadata.jaiabot_version().patch() << std::endl;

                    if (all_pb_metadata.jaiabot_version().has_git_hash())
                        std::cout << "  git hash: " << all_pb_metadata.jaiabot_version().git_hash()
                                  << std::endl;

                    if (all_pb_metadata.jaiabot_version().has_git_branch())
                        std::cout << "  git branch: "
                                  << all_pb_metadata.jaiabot_version().git_branch() << std::endl;

                    if (all_pb_metadata.jaiabot_version().has_deb_repository())
                        std::cout << "  deb repository: "
                                  << all_pb_metadata.jaiabot_version().deb_repository()
                                  << std::endl;

                    if (all_pb_metadata.jaiabot_version().has_deb_release_branch())
                        std::cout << "  deb release branch: "
                                  << all_pb_metadata.jaiabot_version().deb_release_branch()
                                  << std::endl;
                }

                break;
            case jaiabot::config::VersionTool::goby:
                *display_pb_metadata.mutable_goby_version() = all_pb_metadata.goby_version();
                if (app_cfg().format() == jaiabot::config::VersionTool::text)
                {
                    std::cout << "goby: " << all_pb_metadata.goby_version() << std::endl;
                }
                break;
            case jaiabot::config::VersionTool::moos:
                *display_pb_metadata.mutable_moos_version() = all_pb_metadata.moos_version();
                if (app_cfg().format() == jaiabot::config::VersionTool::text)
                {
                    std::cout << "moos: " << all_pb_metadata.moos_version() << std::endl;
                }
                break;
            case jaiabot::config::VersionTool::raspi:

                *display_pb_metadata.mutable_raspi_firmware_version() =
                    all_pb_metadata.raspi_firmware_version();
                if (app_cfg().format() == jaiabot::config::VersionTool::text)
                {
                    std::cout << "raspberry pi firmware: "
                              << all_pb_metadata.raspi_firmware_version() << std::endl;
                }
                break;
            case jaiabot::config::VersionTool::image:
                *display_pb_metadata.mutable_jaiabot_image_version() =
                    all_pb_metadata.jaiabot_image_version();
                if (app_cfg().format() == jaiabot::config::VersionTool::text)
                {
                    std::cout << "jaiabot rootfs image: " << all_pb_metadata.jaiabot_image_version()
                              << std::endl;
                }
                break;
        }
    }

    switch (app_cfg().format())
    {
        case jaiabot::config::VersionTool::protobuf:
            std::cout << display_pb_metadata.DebugString() << std::endl;
            break;
        case jaiabot::config::VersionTool::json:
        {
            google::protobuf::util::JsonPrintOptions j_opts;
            j_opts.add_whitespace = true;
            std::string j_str;
            google::protobuf::util::MessageToJsonString(display_pb_metadata, &j_str, j_opts);
            std::cout << j_str << std::endl;
            break;
        }

        case jaiabot::config::VersionTool::text:
            // already printed
            break;
    }

    quit(0);
}
