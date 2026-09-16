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

#include <numeric>

#include "../../states.h"

using goby::glog;

void jaiabot::statechart::self_test::AirDescentDataOffload::mcu_response(const EvMCUResponse& ev)
{
    glog.is_debug1() && glog << group("statechart") << "[mcu resp] " << ev.resp.ShortDebugString()
                             << std::endl;

    switch (ev.resp.payload_case())
    {
        case protobuf::StormMCUResponse::kAirDescentMetadata:
            if (air_descent_metadata_)
            {
                glog.is_warn() && glog << group("statechart")
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

            if (!data_offloaded_from_mcu_ && air_descent_metadata_ &&
                air_descent_data_.size() == air_descent_metadata_->num_packets())
            {
                glog.is_verbose() && glog << group("statechart")
                                          << "All air descent data received from MCU" << std::endl;

                data_offloaded_from_mcu_ = true;
                convert_air_descent_data_to_task_packets();
                convert_icas_data_to_task_packets();
                try_send_to_shore();
            }

            break;

        case protobuf::StormMCUResponse::kSleepInitiated: // this is for Sleep state...
            glog.is_warn() && glog << group("statechart")
                                   << "[mcu resp] Unexpected sleep initiated response!"
                                   << std::endl;

            break;

        case protobuf::StormMCUResponse::PAYLOAD_NOT_SET:
            glog.is_warn() && glog << group("statechart") << "[mcu resp] No payload!" << std::endl;
            break;
    }
}

void jaiabot::statechart::self_test::AirDescentDataOffload::loop(const EvLoop& ev)
{
    auto now = goby::time::SteadyClock::now();
    if (!data_offloaded_from_mcu_)
    {
        if (now >= next_mcu_send_time_)
        {
            try_send_to_mcu();
            next_mcu_send_time_ = now + this->machine().mcu_send_interval();
        }
    }

    if (now >= offload_timeout_)
    {
        this->machine().insert_warning(
            protobuf::WARNING__STORM_SELF_TEST__AIR_DESCENT_DATA_OFFLOAD_TIMEOUT);
        post_event(EvAirDescentDataTimeout());
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
    else if (!data_offloaded_from_mcu_)
    {
        int next_index = air_descent_data_.empty() ? 0 : air_descent_data_.rbegin()->first + 1;
        protobuf::StormMCURequest request;
        request.set_type(protobuf::StormMCURequest::AIR_DESCENT_DATA_REQUEST);
        request.set_packet_index(next_index);
        this->app().send_to_mcu(request);
    }
}

void jaiabot::statechart::self_test::AirDescentDataOffload::
    convert_air_descent_data_to_task_packets()
{
    for (const auto& [id, air_data] : air_descent_data_)
    {
        protobuf::TaskPacket task_packet;
        task_packet.set_bot_id(this->cfg().bot_id());
        task_packet.set_type(protobuf::MissionTask::STORM_AIR_DESCENT);
        *task_packet.mutable_storm_air_descent() = air_data;

        const std::uint64_t samples_per_packet = protobuf::StormAirDescentData::descriptor()
                                                     ->FindFieldByName("sample")
                                                     ->options()
                                                     .GetExtension(dccl::field)
                                                     .max_repeat();

        // use the overall start/end time to determine start/end time for each packet
        goby::time::MicroTime full_packet_duration(static_cast<float>(samples_per_packet) /
                                                   air_descent_metadata_->sample_rate_with_units());
        auto start_time = air_descent_metadata_->start_time_with_units() +
                          static_cast<goby::time::MicroTime::value_type>(
                              task_packet.storm_air_descent().packet_index()) *
                              full_packet_duration;

        goby::time::MicroTime this_packet_duration(
            static_cast<float>(task_packet.storm_air_descent().sample_size()) /
            air_descent_metadata_->sample_rate_with_units());
        auto end_time = start_time + this_packet_duration;
        task_packet.set_start_time_with_units(start_time);
        task_packet.set_end_time_with_units(end_time);
        this->app().enqueue_task_packet(task_packet);
    }
}

void jaiabot::statechart::self_test::AirDescentDataOffload::convert_icas_data_to_task_packets()
{
    const auto& icas_samples = this->app().icas_air_descent_samples();
    if (icas_samples.empty())
        return;

    const std::size_t samples_per_packet = protobuf::StormAirDescentICASData::descriptor()
                                               ->FindFieldByName("sample")
                                               ->options()
                                               .GetExtension(dccl::field)
                                               .max_repeat();

    const std::size_t max_task_packets =
        std::max(1, this->cfg().icas_air_descent_max_task_packets());
    const std::size_t max_total_samples = samples_per_packet * max_task_packets;

    // pick representative sample indices, same downsampling approach used for Dive
    // measurements, using temperature as the representative curve
    std::vector<std::size_t> selected_indices;
    if (icas_samples.size() <= max_total_samples)
    {
        selected_indices.resize(icas_samples.size());
        std::iota(selected_indices.begin(), selected_indices.end(), 0);
    }
    else
    {
        std::vector<utils::Point> points;
        points.reserve(icas_samples.size());
        for (std::size_t i = 0; i < icas_samples.size(); ++i)
            points.push_back({static_cast<double>(i), icas_samples[i].data.temperature_celsius()});

        glog.is_warn() && glog << group("statechart") << "Number of ICAS air descent samples ("
                               << icas_samples.size() << ") exceed budget of " << max_total_samples
                               << " across " << max_task_packets << " TaskPackets. Downsampling."
                               << std::endl;

        selected_indices = utils::downsampleIndices(points, max_total_samples);
    }

    std::uint32_t packet_index = 0;
    for (std::size_t chunk_start = 0; chunk_start < selected_indices.size();
         chunk_start += samples_per_packet, ++packet_index)
    {
        const std::size_t chunk_end =
            std::min(chunk_start + samples_per_packet, selected_indices.size());

        protobuf::StormAirDescentICASData icas_data;
        icas_data.set_packet_index(packet_index);
        for (std::size_t i = chunk_start; i < chunk_end; ++i)
        {
            const auto& sample = icas_samples[selected_indices[i]];
            auto* out_sample = icas_data.add_sample();
            out_sample->set_temperature(sample.data.temperature_celsius());
            out_sample->set_relative_humidity(sample.data.relative_humidity_percent());
        }

        protobuf::TaskPacket task_packet;
        task_packet.set_bot_id(this->cfg().bot_id());
        task_packet.set_type(protobuf::MissionTask::STORM_AIR_DESCENT);
        task_packet.set_start_time_with_units(
            icas_samples[selected_indices[chunk_start]].received_time);
        task_packet.set_end_time_with_units(
            icas_samples[selected_indices[chunk_end - 1]].received_time);
        *task_packet.mutable_icas_air_descent() = icas_data;
        this->app().enqueue_task_packet(task_packet);
    }
}
