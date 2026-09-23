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
struct DataOffload;
#else
struct DataOffload : boost::statechart::state<DataOffload, SleepPrep>,
                     Notify<DataOffload, protobuf::SLEEP_PREP__DATA_OFFLOAD>,
                     TaskPacketCommon<DataOffload, EvDataOffloadComplete>

{
    using StateBase = boost::statechart::state<DataOffload, SleepPrep>;

    friend class TaskPacketCommon<DataOffload, EvDataOffloadComplete>;

    DataOffload(typename StateBase::my_context c) : StateBase(c) { try_send_to_shore(); }
    ~DataOffload() {}

  private:
    void loop(const EvLoop& ev)
    {
        auto now = goby::time::SteadyClock::now();
        if (now >= offload_timeout_)
        {
            goby::glog.is_warn() &&
                goby::glog << group("statechart") << "[iridium] Data offload timed out with "
                           << this->machine().task_packet_queue().size()
                           << " TaskPacket(s) outstanding; they stay in the outbox and are "
                              "retried on the next wake"
                           << std::endl;
            post_event(EvDataOffloadTimeout());
            return;
        }

        // Checked here, not just in the ack callback: the queue may be drained by acks
        // for a dead state's packets, which would otherwise never post completion.
        if (!this->task_packets_outstanding())
        {
            post_event(EvDataOffloadComplete());
            return;
        }

        this->retry_pending_task_packets();
    }

  public:
    using reactions = boost::mpl::list<
        boost::statechart::transition<EvDataOffloadComplete, Wrapup>,
        boost::statechart::transition<EvDataOffloadTimeout, Wrapup>,
        boost::statechart::in_state_reaction<EvLoop, DataOffload, &DataOffload::loop>>;

  private:
    goby::time::SteadyClock::time_point offload_timeout_{
        goby::time::SteadyClock::now() +
        goby::time::convert_duration<goby::time::SteadyClock::duration>(
            this->machine().mission().data_offload_timeout_minutes_with_units())};
};
#endif
