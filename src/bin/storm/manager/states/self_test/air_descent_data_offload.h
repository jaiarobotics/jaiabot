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
struct AirDescentDataOffload;
#else
struct AirDescentDataOffload
    : boost::statechart::state<AirDescentDataOffload, SelfTest>,
      Notify<AirDescentDataOffload, protobuf::SELF_TEST__AIR_DESCENT_DATA_OFFLOAD>
{
    using StateBase = boost::statechart::state<AirDescentDataOffload, SelfTest>;

    AirDescentDataOffload(typename StateBase::my_context c) : StateBase(c)
    {
        protobuf::StormMCURequest request;
        request.set_type(protobuf::StormMCURequest::AIR_DESCENT_DATA_REQUEST);
        this->app().send_to_mcu(request);
    }
    ~AirDescentDataOffload() {}

    void mcu_response(const EvMCUResponse& ev)
    {
        goby::glog.is_debug1() && goby::glog << group("statechart") << "[mcu resp] "
                                             << ev.resp.ShortDebugString() << std::endl;
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvAirDescentDataTransmitted, Wrapup>,
        boost::statechart::transition<EvAirDescentDataTimeout, Wrapup>,
        boost::statechart::in_state_reaction<EvMCUResponse, AirDescentDataOffload,
                                             &AirDescentDataOffload::mcu_response>>;
};
#endif
