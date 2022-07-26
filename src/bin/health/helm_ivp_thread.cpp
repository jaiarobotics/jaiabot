
#include <boost/units/io.hpp>

#include "system_thread.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/moos.pb.h"

using goby::glog;

jaiabot::apps::HelmIVPStatusThread::HelmIVPStatusThread(
    const jaiabot::config::HelmIVPStatusConfig& cfg)
    : HealthMonitorThread(cfg, "helm_ivp_status", 1.0 / 60.0 * boost::units::si::hertz)
{
    interprocess().subscribe<jaiabot::groups::moos>([this](const protobuf::MOOSMessage& moos_msg) {
        if (moos_msg.key() == "IVPHELM_STATE")
        {
            status_.set_helm_ivp_state(moos_msg.svalue());
            if (moos_msg.svalue() == "PARK")
            {
                helm_ivp_status_successful_ = false;
            }
            else
            {
                helm_ivp_status_successful_ = true;
            }
        }
    });
}

void jaiabot::apps::HelmIVPStatusThread::issue_status_summary()
{
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::helm_ivp>(status_);
}

void jaiabot::apps::HelmIVPStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (!helm_ivp_status_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__MOOS__HELMIVP_STATE_NOT_DRIVE);
    }

    health.set_state(health_state);
}
