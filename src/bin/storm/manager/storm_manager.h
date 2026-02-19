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

#ifndef JAIABOT_BIN_STORM_MANAGER_STORM_MANAGER_H
#define JAIABOT_BIN_STORM_MANAGER_STORM_MANAGER_H

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

#include "machine_common.h"

namespace jaiabot
{
namespace apps
{
class StormManager : public goby::zeromq::MultiThreadApplication<config::StormManager>
{
  public:
    StormManager();
    ~StormManager();

  private:
    void initialize() override;
    void finalize() override;
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;


    template <typename Derived> friend class statechart::AppMethodsAccess;

  private:
    std::unique_ptr<statechart::StormManagerStateMachine> machine_;
};

} // namespace apps
} // namespace jaiabot

#endif
