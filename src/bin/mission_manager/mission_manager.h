#ifndef JAIABOT_BIN_MISSION_MANAGER_MISSION_MANAGER_H
#define JAIABOT_BIN_MISSION_MANAGER_MISSION_MANAGER_H

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/modem_message_extensions.pb.h"

#include "machine_common.h"
#include <bits/stdc++.h>
#include <cmath>
#include <math.h>
#include <queue>

namespace jaiabot
{
namespace apps
{
class MissionManager : public goby::zeromq::MultiThreadApplication<config::MissionManager>
{
  public:
    MissionManager();
    ~MissionManager();

    bool is_test_mode(jaiabot::config::MissionManager::EngineeringTestMode mode)
    {
        return test_modes_.count(mode);
    }

  private:
    void initialize() override;
    void finalize() override;
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    bool health_considered_ok(const goby::middleware::protobuf::VehicleHealth& vehicle_health);

    void handle_command(const protobuf::Command& command);
    bool handle_command_fragment(const protobuf::Command& input_command_fragment,
                                 protobuf::Command& out_command);
    void handle_bottom_dive_safety_params(const protobuf::BottomDepthSafetyParams);

    void handle_self_test_results(bool result); // TODO: replace with Protobuf message
    double deg2rad(const double& deg);
    double distanceToGoal(const double& lat1d, const double& lon1d, const double& lat2d,
                          const double& lon2d);
    void intervehicle_subscribe(const jaiabot::protobuf::HubInfo& hub_info);

    void check_forward_progress();

    template <typename Derived> friend class statechart::AppMethodsAccess;

  private:
    std::unique_ptr<statechart::MissionManagerStateMachine> machine_;
    std::map<uint64_t, std::map<uint8_t, protobuf::Command>> track_command_fragments;

    std::set<jaiabot::config::MissionManager::EngineeringTestMode> test_modes_;
    std::set<jaiabot::protobuf::Error> ignore_errors_;

    // if we don't get latitude information, we'll compute depth based on mid-latitude
    // (45 degrees), which will introduce up to 0.27% error at 500 meters depth
    // at the equator or the poles
    boost::units::quantity<boost::units::degree::plane_angle> latest_lat_{
        45 * boost::units::degree::degrees};

    goby::middleware::protobuf::gpsd::TimePositionVelocity current_tpv_;

    // Goal Dist History
    std::queue<double> current_goal_dist_history_;

    // Current Goal
    int current_goal_{-2};
    bool updated_goal_{true};
    int goal_timeout_{0};
    bool use_goal_timeout_{false};
    goby::time::SteadyClock::time_point last_goal_timeout_time_{std::chrono::seconds(0)};
    std::set<jaiabot::protobuf::MissionState> include_goal_timeout_states_;

    goby::middleware::protobuf::TransporterConfig latest_command_sub_cfg_;
    goby::middleware::protobuf::TransporterConfig latest_contact_update_sub_cfg_;

    // Store when we get a new hub
    int32_t hub_id_{0};

    // Store previous command time to ensure it is newer and to ignore duplicates
    uint64_t prev_command_time_{0};

    // Data for determining if we are making forward progress
    struct ForwardProgressData
    {
        boost::units::quantity<boost::units::degree::plane_angle> latest_pitch;
        boost::units::quantity<boost::units::si::velocity> latest_desired_speed;
        goby::time::SteadyClock::time_point no_forward_progress_timeout;
    };

    ForwardProgressData fwd_progress_data_;
};

} // namespace apps
} // namespace jaiabot

#endif
