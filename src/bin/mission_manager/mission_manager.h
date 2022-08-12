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

  private:
    void initialize() override;
    void finalize() override;
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    void handle_command(const protobuf::Command& command);
    bool handle_command_fragment(const protobuf::Command& input_command_fragment,
                                 protobuf::Command& out_command);

    void handle_self_test_results(bool result); // TODO: replace with Protobuf message

    template <typename Derived> friend class statechart::AppMethodsAccess;

  private:
    std::unique_ptr<statechart::MissionManagerStateMachine> machine_;
    std::map<uint64_t, std::map<uint8_t, protobuf::Command>> track_command_fragments;
};

} // namespace apps
} // namespace jaiabot

#endif
