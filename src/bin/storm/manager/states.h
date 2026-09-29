// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
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

#pragma once

// Boost
#include <boost/statechart/custom_reaction.hpp>
#include <boost/statechart/in_state_reaction.hpp>
#include <boost/statechart/state.hpp>
#include <boost/statechart/termination.hpp>
#include <boost/statechart/transition.hpp>

// Protobuf
#include <google/protobuf/util/json_util.h>

// Jaiabot
#include "jaiabot/intervehicle.h"
#include "jaiabot/messages/low_control.pb.h"
using namespace jaiabot::protobuf;

// Storm Manager app
#include "events.h"
#include "machine_common.h"
#include "state_machine.h"

// States

// forward declaration
#define JAIABOT_STORM_MANAGER_FWD_DECL
#include "states/root.h"
#undef JAIABOT_STORM_MANAGER_FWD_DECL

// actual definition
#include "states/root.h"
