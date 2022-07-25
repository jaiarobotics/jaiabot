
#include <boost/units/io.hpp>

#include "system_thread.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/moos.pb.h"

using goby::glog;

jaiabot::apps::IVPHelmStatusThread::IVPHelmStatusThread(
    const jaiabot::config::IVPHelmStatusConfig& cfg)
    : HealthMonitorThread(cfg, "ivp_helm_status", 1.0 / 60.0 * boost::units::si::hertz)
{
}

void jaiabot::apps::IVPHelmStatusThread::issue_status_summary()
{
    status_.Clear();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::ivp_helm>(status_);
}

bool jaiabot::apps::IVPHelmStatusThread::read_ivp_helm_state()
{
    interprocess().subscribe<jaiabot::groups::moos>([this](const protobuf::MOOSMessage& moos_msg) {
        if (moos_msg.key() == "IVPHELM_STATE")
        {
            glog.is_verbose() && glog << "Received IVPHELM_STATE: " << moos_msg.svalue()
                                      << std::endl;
            if (moos_msg.svalue() != "PARK")
            {
                //error_ivp_state_.clear();
                //error_ivp_state_.push_back(protobuf::ERROR__MOOS__HELMIVP_STATE_NOT_DRIVE);
            }
        }
    });
    return true;
}

void jaiabot::apps::IVPHelmStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    health.set_state(health_state);
}
