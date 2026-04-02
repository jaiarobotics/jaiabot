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
      Notify<AirDescentDataOffload, protobuf::SELF_TEST__AIR_DESCENT_DATA_OFFLOAD>,
      TaskPacketCommon<AirDescentDataOffload, EvAirDescentDataTransmitted>
{
    using StateBase = boost::statechart::state<AirDescentDataOffload, SelfTest>;

    friend class TaskPacketCommon<AirDescentDataOffload, EvAirDescentDataTransmitted>;

    AirDescentDataOffload(typename StateBase::my_context c) : StateBase(c) {}
    ~AirDescentDataOffload() {}

  private:
    void mcu_response(const EvMCUResponse& ev);
    void loop(const EvLoop& ev);
    void try_send_to_mcu();
    void convert_air_descent_data_to_task_packets();

  public:
    using reactions =
        boost::mpl::list<boost::statechart::transition<EvAirDescentDataTransmitted, Wrapup>,
                         boost::statechart::transition<EvAirDescentDataTimeout, Wrapup>,
                         boost::statechart::in_state_reaction<EvMCUResponse, AirDescentDataOffload,
                                                              &AirDescentDataOffload::mcu_response>,
                         boost::statechart::in_state_reaction<EvLoop, AirDescentDataOffload,
                                                              &AirDescentDataOffload::loop>>;

  private:
    std::unique_ptr<StormAirDescentMetadata> air_descent_metadata_;
    // packet index -> data
    std::map<int, StormAirDescentData> air_descent_data_;
    bool data_offloaded_from_mcu_{false};

    goby::time::SteadyClock::time_point next_mcu_send_time_{goby::time::SteadyClock::now()};

    goby::time::SteadyClock::time_point offload_timeout_{
        goby::time::SteadyClock::now() +
        goby::time::convert_duration<goby::time::SteadyClock::duration>(
            this->machine().mission().data_offload_timeout_minutes_with_units())};
};
#endif
