#pragma once

// Boost
#include <boost/statechart/state.hpp>
#include <boost/statechart/transition.hpp>
#include <boost/statechart/in_state_reaction.hpp>
#include <boost/statechart/deep_history.hpp>
#include <boost/statechart/custom_reaction.hpp>

// Protobuf
#include <google/protobuf/util/json_util.h>

// Jaiabot
#include "jaiabot/intervehicle.h"
#include "jaiabot/utils/mission_manager_utils.h"
#include "jaiabot/messages/dive_debug.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/echo.pb.h"
using namespace jaiabot::protobuf;

// Mission Manager app
#include "events.h"
#include "machine_common.h"
#include "mission_manager_state_machine.h"
#include "ivp_behavior_update.h"

// States
#include "states/states_fwd.h"

namespace jaiabot::statechart {

    #include "states/predeployment.h"
    #include "states/inmission.h"
    #include "states/postdeployment.h"

}
