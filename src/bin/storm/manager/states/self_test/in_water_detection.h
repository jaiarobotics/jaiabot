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
struct InWaterDetection : ThresholdCommon<InWaterDetection, SelfTest,
                                          protobuf::SELF_TEST__IN_WATER_DETECTION, EvWaterDetected>
{
    using Base = ThresholdCommon<InWaterDetection, SelfTest,
                                 protobuf::SELF_TEST__IN_WATER_DETECTION, EvWaterDetected>;

    InWaterDetection(typename Base::my_context c) : Base(c)
    {
        this->set_threshold_cfg(this->machine().mission().in_water().threshold());
    }
    ~InWaterDetection() {}

    using local_reactions =
        boost::mpl::list<boost::statechart::transition<EvWaterDetected, LaunchTubeDetection>>;

    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};

#endif
