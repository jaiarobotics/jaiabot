#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot_gateway_plugin.h"

using goby::glog;

extern "C"
{
    void goby3_moos_gateway_load(
        goby::zeromq::MultiThreadApplication<goby::apps::moos::protobuf::GobyMOOSGatewayConfig>*
            handler)
    {
        handler->launch_thread<jaiabot::moos::AllMessagesForLoggingTranslation>();
        handler->launch_thread<jaiabot::moos::IvPHelmTranslation>();
    }

    void goby3_moos_gateway_unload(
        goby::zeromq::MultiThreadApplication<goby::apps::moos::protobuf::GobyMOOSGatewayConfig>*
            handler)
    {
        handler->join_thread<jaiabot::moos::IvPHelmTranslation>();
        handler->join_thread<jaiabot::moos::AllMessagesForLoggingTranslation>();
    }
}

void jaiabot::moos::IvPHelmTranslation::publish_bhv_update(
    const protobuf::IvPBehaviorUpdate& update)
{
    // we don't want the Helm in Park ever
    moos().comms().Notify("MOOS_MANUAL_OVERRIDE", "false");

    switch (update.behavior_case())
    {
        case protobuf::IvPBehaviorUpdate::kTransit:
        {
            if (update.transit().active())
            {
                std::stringstream update_ss;
                update_ss << "point=" << update.transit().x() << "," << update.transit().y()
                          << "#speed=" << update.transit().speed();
                moos().comms().Notify("JAIABOT_TRANSIT_UPDATES", update_ss.str());
            }

            // order matters!
            //   post after JAIABOT_TRANSIT_UPDATES to ensure new waypoint
            //   is loaded before the behavior becomes active
            moos().comms().Notify("JAIABOT_WAYPOINT_ACTIVE",
                                  update.transit().active() ? "true" : "false");

            break;
        }

        case protobuf::IvPBehaviorUpdate::kStationkeep:
        {
            std::stringstream update_ss;
            if (update.stationkeep().active())
            {
                if (update.stationkeep().center_activate())
                    update_ss << "center_activate=true";
                else
                    update_ss << "center_activate=false#station_pt=" << update.stationkeep().x()
                              << "," << update.stationkeep().y();

                update_ss << "#outer_speed=" << update.stationkeep().outer_speed()
                          << "#transit_speed=" << update.stationkeep().transit_speed();
                moos().comms().Notify("JAIABOT_STATIONKEEP_UPDATES", update_ss.str());
            }

            moos().comms().Notify("JAIABOT_STATIONKEEP_ACTIVE",
                                  update.stationkeep().active() ? "true" : "false");

            break;
        }

        case protobuf::IvPBehaviorUpdate::BEHAVIOR_NOT_SET: break;
    }
}
