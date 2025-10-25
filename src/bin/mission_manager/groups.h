#ifndef JAIABOT_MISSION_MANAGER_GROUPS_H
#define JAIABOT_MISSION_MANAGER_GROUPS_H

#include <goby/middleware/group.h>

namespace jaiabot
{

namespace groups {
constexpr goby::middleware::Group state_change{"jaiabot::state_change"};
}

namespace apps
{

namespace groups
{
extern std::unique_ptr<goby::middleware::DynamicGroup> hub_command_this_bot;
} // namespace groups

} // namespace apps
} // namespace jaiabot

#endif // JAIABOT_MISSION_MANAGER_GROUPS_H