#ifndef JAIABOT_SRC_LIB_HUB_MISSION_NAME_H
#define JAIABOT_SRC_LIB_HUB_MISSION_NAME_H

#include <string>

#include <dccl/option_extensions.pb.h>

#include "jaiabot/messages/jaia_dccl.pb.h"

namespace jaiabot
{
namespace hub
{
/// \return the name's longest leading part that fits Hub2HubData.mission_name, cut between UTF-8 characters
inline std::string fit_mission_name(const std::string& name)
{
    static const std::size_t max_bytes = protobuf::Hub2HubData::descriptor()
                                             ->FindFieldByName("mission_name")
                                             ->options()
                                             .GetExtension(dccl::field)
                                             .max_length();
    if (name.size() <= max_bytes)
        return name;

    std::size_t end = max_bytes;
    // back up past UTF-8 continuation bytes (10xxxxxx) to the start of the cut character
    while (end > 0 && (static_cast<unsigned char>(name[end]) & 0xC0) == 0x80) --end;
    return name.substr(0, end);
}

} // namespace hub
} // namespace jaiabot

#endif
