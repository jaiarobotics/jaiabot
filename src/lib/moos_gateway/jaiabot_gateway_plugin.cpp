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
    // if we're waiting for the new NAV_* to be published post datum update,
    // hold back on publishing this update until we get a new NAV_X
    if (pending_datum_update_)
    {
        glog.is_debug1() &&
            glog << "Waiting on NAV_* to be republished before writing a new IvPBehaviorUpdate"
                 << std::endl;
        pending_bhv_update_.reset(new protobuf::IvPBehaviorUpdate(update));
        return;
    }

    glog.is_debug1() && glog << "Processing IvPBehaviorUpdate: " << update.ShortDebugString()
                             << std::endl;

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
                          << "#speed=" << update.transit().speed()
                          << "#nm_radius=" << update.transit().slip_radius();
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

        case protobuf::IvPBehaviorUpdate::kConstantHeading:
        {
            glog.is_verbose() && glog << "kConstantHeading: " << update.ShortDebugString()
                                      << std::endl;
            std::stringstream update_ss;
            if (update.constantheading().active())
            {
                update_ss << "heading=" << update.constantheading().heading();
                moos().comms().Notify("JAIABOT_CONSTANTHEADING_UPDATES", update_ss.str());
            }

            moos().comms().Notify("JAIABOT_CONSTANTHEADING_ACTIVE",
                                  update.constantheading().active() ? "true" : "false");

            break;
        }

        case protobuf::IvPBehaviorUpdate::kConstantSpeed:
        {
            glog.is_verbose() && glog << "kConstantSpeed: " << update.ShortDebugString()
                                      << std::endl;
            std::stringstream update_ss;
            if (update.constantspeed().active())
            {
                update_ss << "speed=" << update.constantspeed().speed();
                moos().comms().Notify("JAIABOT_CONSTANTSPEED_UPDATES", update_ss.str());
            }

            moos().comms().Notify("JAIABOT_CONSTANTSPEED_ACTIVE",
                                  update.constantspeed().active() ? "true" : "false");

            break;
        }

        case protobuf::IvPBehaviorUpdate::BEHAVIOR_NOT_SET: break;
    }
}
