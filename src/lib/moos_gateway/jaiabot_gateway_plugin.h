#ifndef JAIABOT_LIB_MOOS_GATEWAY_H
#define JAIABOT_LIB_MOOS_GATEWAY_H

#include <goby/moos/middleware/moos_plugin_translator.h>
#include <goby/moos/protobuf/moos_gateway_config.pb.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/mission.pb.h"

namespace jaiabot
{
namespace moos
{
class IvPHelmTranslation : public goby::moos::Translator
{
  public:
    IvPHelmTranslation(const goby::apps::moos::protobuf::GobyMOOSGatewayConfig& cfg)
        : goby::moos::Translator(cfg)
    {
        goby().interprocess().subscribe<jaiabot::groups::mission_ivp_behavior_update>(
            [this](const protobuf::IvPBehaviorUpdate& update) { publish_bhv_update(update); });

        goby().interprocess().subscribe<jaiabot::groups::mission_report>(
            [this](const protobuf::MissionReport& report) {
                moos().comms().Notify("JAIABOT_MISSION_STATE",
                                      jaiabot::protobuf::MissionState_Name(report.state()));
            });

        moos().add_trigger("JAIABOT_TRANSIT_COMPLETE", [this](const CMOOSMsg& msg) {
            if (msg.GetString() == "true")
            {
                protobuf::IvPBehaviorReport report;
                report.mutable_transit()->set_waypoint_reached(true);
                goby().interprocess().publish<jaiabot::groups::mission_ivp_behavior_report>(report);
            }
        });
    }

  private:
    void publish_bhv_update(const protobuf::IvPBehaviorUpdate& update);
};

} // namespace moos
} // namespace jaiabot

#endif
