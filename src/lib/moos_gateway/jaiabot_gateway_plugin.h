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
        // once get a datum update, wait until the next NAV_X (published from NodeStatus)
        // before we send any new IvPBehaviorUpdate messages. If not, we can get a race condition where
        // the Helm completes a Transit if the current position (in X,Y) is the same as the recovery position (in X,Y).
        goby().interprocess().subscribe<goby::middleware::groups::datum_update>(
            [this](const goby::middleware::protobuf::DatumUpdate& datum_update) {
                goby::glog.is_debug1() && goby::glog << "Datum update received." << std::endl;
                pending_datum_update_ = true;
            });
        // use NAV_X as a proxy for a new full NAV_* update (via goby::moos::FrontSeatTranslation from NodeStatus)
        // once received, flush any pending update
        moos().add_trigger("NAV_X", [this](const CMOOSMsg&) {
            pending_datum_update_ = false;
            if (pending_bhv_update_)
            {
                goby::glog.is_debug1() &&
                    goby::glog << "NAV_X received, flushing pending IvPBehaviorUpdate" << std::endl;

                publish_bhv_update(*pending_bhv_update_);
                pending_bhv_update_.reset();
            }
        });

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

  private:
    bool pending_datum_update_{false};
    std::unique_ptr<protobuf::IvPBehaviorUpdate> pending_bhv_update_;

}; // namespace moos

} // namespace moos
} // namespace jaiabot

#endif
