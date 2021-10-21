#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot_gateway_plugin.h"

using goby::glog;

extern "C"
{
    void goby3_moos_gateway_load(
        goby::zeromq::MultiThreadApplication<goby::apps::moos::protobuf::GobyMOOSGatewayConfig>*
            handler)
    {
        handler->launch_thread<jaiabot::moos::IvPHelmTranslation>();
    }

    void goby3_moos_gateway_unload(
        goby::zeromq::MultiThreadApplication<goby::apps::moos::protobuf::GobyMOOSGatewayConfig>*
            handler)
    {
        handler->join_thread<jaiabot::moos::IvPHelmTranslation>();
    }
}

void jaiabot::moos::IvPHelmTranslation::publish_bhv_update(
    const protobuf::IvPBehaviorUpdate& update)
{
    switch (update.behavior_case())
    {
        case protobuf::IvPBehaviorUpdate::kTransit:
        {
            std::stringstream update_ss;
            update_ss << "point=" << update.transit().x() << "," << update.transit().y()
                      << "#speed=" << update.transit().speed();
            moos().comms().Notify("JAIA_MOVEMENT_TRANSIT_UPDATES", update_ss.str());
            break;
        }

        case protobuf::IvPBehaviorUpdate::BEHAVIOR_NOT_SET: break;
    }
}
