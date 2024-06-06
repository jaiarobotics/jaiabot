#ifndef JAIABOT_LIB_MOOS_GATEWAY_H
#define JAIABOT_LIB_MOOS_GATEWAY_H

#include <goby/moos/middleware/moos_plugin_translator.h>
#include <goby/moos/protobuf/moos_gateway_config.pb.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/mission.pb.h"
#include "jaiabot/messages/moos.pb.h"

#include "jaiabot_gateway_config.pb.h"
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

class AllMessagesForLoggingTranslation : public goby::moos::Translator
{
  public:
    AllMessagesForLoggingTranslation(const goby::apps::moos::protobuf::GobyMOOSGatewayConfig& cfg)
        : goby::moos::Translator(cfg),
          jaiabot_cfg_(cfg.GetExtension(jaiabot::protobuf::jaiabot_gateway_config)),
          omit_var_(jaiabot_cfg_.logging_omit_var_regex()),
          omit_app_(jaiabot_cfg_.logging_omit_app_regex())
    {
        moos().add_wildcard_trigger(
            "*", "*",
            [this](const CMOOSMsg& msg)
            {
                if (jaiabot_cfg_.has_logging_omit_var_regex() &&
                    std::regex_match(msg.m_sKey, omit_var_))
                    return;
                if (jaiabot_cfg_.has_logging_omit_app_regex() &&
                    std::regex_match(msg.m_sSrc, omit_app_))
                    return;

                protobuf::MOOSMessage pb_msg;
                pb_msg.set_type(static_cast<protobuf::MOOSMessage::Type>(msg.m_cDataType));
                pb_msg.set_key(msg.m_sKey);
                switch (pb_msg.type())
                {
                    case protobuf::MOOSMessage::TYPE_DOUBLE: pb_msg.set_dvalue(msg.m_dfVal); break;
                    case protobuf::MOOSMessage::TYPE_STRING: pb_msg.set_svalue(msg.m_sVal); break;
                    case protobuf::MOOSMessage::TYPE_BINARY_STRING:
                        pb_msg.set_bvalue(msg.m_sVal);
                        break;
                }
                pb_msg.set_unixtime(msg.m_dfTime);
                pb_msg.set_id(msg.m_nID);
                pb_msg.set_source(msg.m_sSrc);
                pb_msg.set_source_aux(msg.m_sSrcAux);
                pb_msg.set_community(msg.m_sOriginatingCommunity);
                interprocess().publish<jaiabot::groups::moos>(pb_msg);
            });
    }

  private:
    const jaiabot::protobuf::MOOSGatewayConfig jaiabot_cfg_;
    std::regex omit_var_;
    std::regex omit_app_;
};

} // namespace moos
} // namespace jaiabot

#endif
