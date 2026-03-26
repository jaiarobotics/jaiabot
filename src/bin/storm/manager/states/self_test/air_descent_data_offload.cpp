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

#include "../../states.h"

void jaiabot::statechart::self_test::AirDescentDataOffload::mcu_response(const EvMCUResponse& ev)
{
    goby::glog.is_debug1() && goby::glog << group("statechart") << "[mcu resp] "
                                         << ev.resp.ShortDebugString() << std::endl;

    switch (ev.resp.payload_case())
    {
        case protobuf::StormMCUResponse::kAirDescentMetadata:
            if (air_descent_metadata_)
            {
                goby::glog.is_warn() &&
                    goby::glog << group("statechart")
                               << "[mcu resp] Already have metadata but was sent it again!"
                               << std::endl;
            }
            else
            {
                air_descent_metadata_.reset(
                    new StormAirDescentMetadata(ev.resp.air_descent_metadata()));
            }
            break;

        case protobuf::StormMCUResponse::kAirDescentData:
            air_descent_data_[ev.resp.air_descent_data().packet_index()] =
                ev.resp.air_descent_data();

            if (air_descent_metadata_ &&
                air_descent_data_.size() == air_descent_metadata_->num_packets())
            {
                goby::glog.is_verbose() && goby::glog << group("statechart")
                                                      << "All air descent data received from MCU"
                                                      << std::endl;

                // we have all the data
            }

            break;

        case protobuf::StormMCUResponse::PAYLOAD_NOT_SET:
            goby::glog.is_warn() && goby::glog << group("statechart") << "[mcu resp] No payload!"
                                               << std::endl;
            break;
    }
}

void jaiabot::statechart::self_test::AirDescentDataOffload::loop(const EvLoop& ev)
{
    auto now = goby::time::SteadyClock::now();
    if (now >= next_mcu_send_time_)
    {
        try_send_to_mcu();
        next_mcu_send_time_ = now + mcu_send_interval_;
    }
}

void jaiabot::statechart::self_test::AirDescentDataOffload::try_send_to_mcu()
{
    if (!air_descent_metadata_)
    {
        protobuf::StormMCURequest request;
        request.set_type(protobuf::StormMCURequest::AIR_DESCENT_METADATA_REQUEST);
        this->app().send_to_mcu(request);
    }
    else if (air_descent_data_.size() < air_descent_metadata_->num_packets())
    {
        int next_index = air_descent_data_.empty() ? 0 : air_descent_data_.rbegin()->first + 1;
        protobuf::StormMCURequest request;
        request.set_type(protobuf::StormMCURequest::AIR_DESCENT_DATA_REQUEST);
        request.set_packet_index(next_index);
        this->app().send_to_mcu(request);
    }
}
