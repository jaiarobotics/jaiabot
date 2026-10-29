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

#ifdef JAIABOT_STORM_MANAGER_FWD_DECL
struct InWaterDetection;
#else
struct InWaterDetection : boost::statechart::state<InWaterDetection, SelfTest>,
                          Notify<InWaterDetection, protobuf::SELF_TEST__IN_WATER_DETECTION>,
                          jaiabot::statechart::ThresholdCommon<InWaterDetection>
{
    using StateBase = boost::statechart::state<InWaterDetection, SelfTest>;
    using ThresholdBase = ThresholdCommon<InWaterDetection>;

    InWaterDetection(typename StateBase::my_context c) : StateBase(c)
    {
        this->set_threshold_cfg<EvWaterDetected>("in-water threshold",
                                                 this->machine().mission().in_water().threshold());
    }
    ~InWaterDetection() {}

    using local_reactions =
        boost::mpl::list<boost::statechart::transition<EvWaterDetected, LaunchTubeDetection>>;
    using common_reactions = ThresholdBase::common_reactions; // typedef for jaia_state_tool

    using reactions = typename boost::mpl::copy<local_reactions,
                                                boost::mpl::front_inserter<common_reactions>>::type;
};

#endif
