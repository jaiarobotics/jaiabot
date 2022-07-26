
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
        }
        else if (moos_msg.key() == "JAIABOT_MISSION_STATE")
        {
            if (moos_msg.svalue() == "IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT")
            {
                helm_ivp_in_mission_ = true;
            }
            else
            {
                helm_ivp_in_mission_ = false;
                helm_ivp_desired_speed_ = false;
                helm_ivp_desired_heading_ = false;
                helm_ivp_desired_depth_ = false;
            }
        }
        else if (moos_msg.key() == "DESIRED_SPEED")
        {
            helm_ivp_desired_speed_ = true;
            status_.set_helm_ivp_desired_speed(helm_ivp_desired_speed_);
        }
        else if (moos_msg.key() == "DESIRED_HEADING")
        {
            helm_ivp_desired_heading_ = true;
            status_.set_helm_ivp_desired_heading(helm_ivp_desired_heading_);
        }
        else if (moos_msg.key() == "DESIRED_DEPTH")
        {
            helm_ivp_desired_depth_ = true;
            status_.set_helm_ivp_desired_depth(helm_ivp_desired_depth_);
        }
        // Use NAV_X to test for data as this is the trigger in jaiabot_gateway
        else if (moos_msg.key() == "NAV_X")
        {
            helm_ivp_data_ = true;
            status_.set_helm_ivp_data(helm_ivp_data_);
        }

    });
}

void jaiabot::apps::HelmIVPStatusThread::issue_status_summary()
{
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::helm_ivp>(status_);
    status_.Clear();
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

    if (helm_ivp_in_mission_)
    {
        if (!helm_ivp_desired_speed_ && !helm_ivp_desired_speed_ && !helm_ivp_desired_depth_)
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__MOOS__HELMIVP_NO_DESIRED_DATA);
        }

        if (!helm_ivp_data_)
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__MOOS__NO_DATA);
        }
    }

    health.set_state(health_state);
}
