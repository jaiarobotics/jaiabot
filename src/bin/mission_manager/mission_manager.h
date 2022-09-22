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
#include "machine_common.h"

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

    void handle_self_test_results(bool result); // TODO: replace with Protobuf message

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
};

} // namespace apps
} // namespace jaiabot

#endif
