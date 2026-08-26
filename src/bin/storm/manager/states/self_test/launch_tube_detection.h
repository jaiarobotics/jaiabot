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
struct LaunchTubeDetection;
#else
struct LaunchTubeDetection
    : boost::statechart::state<LaunchTubeDetection, SelfTest>,
      Notify<LaunchTubeDetection, protobuf::SELF_TEST__LAUNCH_TUBE_DETECTION>,
      jaiabot::statechart::ThresholdCommon<LaunchTubeDetection>
{
    using StateBase = boost::statechart::state<LaunchTubeDetection, SelfTest>;

    using ThresholdBase = ThresholdCommon<LaunchTubeDetection>;
    using ThresholdBase::react;

    LaunchTubeDetection(typename StateBase::my_context c) : StateBase(c)
    {
        this->set_threshold_cfg<EvLaunchTubeCleared>(
            "launch tube cleared threshold",
            this->machine().mission().launch_tube().cleared_threshold());

        this->set_threshold_cfg<EvLaunchTubeStuck>(
            "launch tube stuck threshold",
            this->machine().mission().launch_tube().stuck_threshold());
    }
    ~LaunchTubeDetection() {}

    boost::statechart::result react(const EvLaunchTubeCleared&)
    {
        if (this->machine().launch_tube_recovery_attempted())
        {
            this->machine().insert_warning(
                protobuf::
                    WARNING__STORM_SELF_TEST__LAUNCH_TUBE_BELIEVED_STUCK__RECOVERY_SUCCESSFUL);
        }

        return transit<ParachuteAttachmentDetection>();
    }

    using local_reactions =
        boost::mpl::list<boost::statechart::custom_reaction<EvLaunchTubeCleared>,
                         boost::statechart::transition<EvLaunchTubeStuck, LaunchTubeRecovery>>;

    using common_reactions = ThresholdBase::common_reactions; // typedef for jaia_state_tool

    using reactions = typename boost::mpl::copy<local_reactions,
                                                boost::mpl::front_inserter<common_reactions>>::type;
};
#endif
