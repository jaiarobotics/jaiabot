// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matt Ferro <matt.ferro@jaia.tech>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#include <boost/units/io.hpp>

#include "system_thread.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/moos.pb.h"

using goby::glog;

jaiabot::apps::HelmIVPStatusThread::HelmIVPStatusThread(
    const jaiabot::config::HelmIVPStatusConfig& cfg)
    : HealthMonitorThread(cfg, "helm_ivp_status", 4.0 / 60.0 * boost::units::si::hertz)
{
    interprocess().subscribe<jaiabot::groups::moos>([this](const protobuf::MOOSMessage& moos_msg) {
        if (moos_msg.key() == "IVPHELM_STATE")
        {
            status_.set_helm_ivp_state(moos_msg.svalue());
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
            }
        }
        else if (moos_msg.key() == "DESIRED_SPEED")
        {
            status_.set_helm_ivp_desired_speed(true);
        }
        else if (moos_msg.key() == "DESIRED_HEADING")
        {
            status_.set_helm_ivp_desired_heading(true);
        }
        else if (moos_msg.key() == "DESIRED_DEPTH")
        {
            status_.set_helm_ivp_desired_depth(true);
        }
        // Use NAV_X to test for data as this is the trigger in jaiabot_gateway
        else if (moos_msg.key() == "NAV_X")
        {
            status_.set_helm_ivp_data(true);
        }

    });
}

void jaiabot::apps::HelmIVPStatusThread::issue_status_summary()
{
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::helm_ivp>(status_);

    // Reset values for logging.
    // If these values no longer get updates
    // these values will be posted.
    status_.set_helm_ivp_state("UNKNOWN");
    status_.set_helm_ivp_desired_speed(false);
    status_.set_helm_ivp_desired_heading(false);
    status_.set_helm_ivp_desired_depth(false);
    status_.set_helm_ivp_data(false);
}

void jaiabot::apps::HelmIVPStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (status_.helm_ivp_state() != "DRIVE")
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__MOOS__HELMIVP_STATE_NOT_DRIVE);
    }

    // Only check for these vars if
    // the bot is in this state:
    // IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT
    if (helm_ivp_in_mission_)
    {
        if (!status_.helm_ivp_desired_speed() && !status_.helm_ivp_desired_heading() &&
            !status_.helm_ivp_desired_depth())
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__MOOS__HELMIVP_NO_DESIRED_DATA);
        }

        if (!status_.helm_ivp_data())
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__MOOS__NO_DATA);
        }
    }

    health.set_state(health_state);
}
