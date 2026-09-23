#pragma once

// run function if weak pointer is valid
struct lifetime_token
{
};
template <typename F> void if_alive(const std::weak_ptr<lifetime_token>& weak, F&& f)
{
    if (!weak.expired())
        std::forward<F>(f)();
}

template <typename Derived, typename DataOffloadCompletedEvent> struct TaskPacketCommon
{
    void try_send_to_shore()
    {
        auto self = static_cast<Derived*>(this);
        if (!task_packets_outstanding())
        {
            goby::glog.is_verbose() && goby::glog << group("statechart")
                                                  << "[iridium] No TaskPackets to send"
                                                  << std::endl;
            self->post_event(DataOffloadCompletedEvent());
            return;
        }

        fill_pipeline();
    }

    // Are any of the packets this state is waiting on still queued?
    //
    // An unset owned_task_packet_ids_ means "the whole queue" - that is DataOffload,
    // which drains everything before sleep. AirDescentDataOffload sets it so that self
    // test finishes once its own packets are ack'd, rather than blocking the mission on a
    // backlog replayed from a previous wake. It still helps send that backlog; it just
    // does not wait for it. Set-but-empty is meaningful: that is what we get when every
    // enqueue_task_packet() failed to persist, and it must not fall back to waiting on
    // the whole queue.
    bool task_packets_outstanding()
    {
        const auto& queue = static_cast<Derived*>(this)->machine().task_packet_queue();
        if (!owned_task_packet_ids_)
            return !queue.empty();

        return std::any_of(queue.begin(), queue.end(),
                           [this](const protobuf::TaskPacket& task_packet)
                           { return owned_task_packet_ids_->count(task_packet.storm_id()) > 0; });
    }

    // Drives deferred retries; call from each state's EvLoop reaction. Unlike
    // try_send_to_shore() this never posts the completion event - each state checks for
    // completion itself, so that it does not depend on which state's ack callback happens
    // to see the queue drain.
    void retry_pending_task_packets()
    {
        if (static_cast<Derived*>(this)->machine().task_packet_queue().empty())
            return;

        fill_pipeline();
    }

    void fill_pipeline()
    {
        auto self = static_cast<Derived*>(this);
        auto& machine = self->machine();
        auto& in_flight = machine.task_packets_in_flight();
        auto& deferred_until = machine.task_packets_deferred_until();
        const auto now = goby::time::SteadyClock::now();

        std::vector<protobuf::TaskPacket> to_send;
        for (const auto& task_packet : machine.task_packet_queue())
        {
            if (in_flight.size() + to_send.size() >= machine.max_task_packets_in_flight())
                break;
            if (in_flight.count(task_packet.storm_id()))
                continue;

            auto deferred_it = deferred_until.find(task_packet.storm_id());
            if (deferred_it != deferred_until.end() && now < deferred_it->second)
                continue;

            to_send.push_back(task_packet);
        }

        for (const auto& task_packet : to_send) publish_task_packet(task_packet);
    }

    void publish_task_packet(const protobuf::TaskPacket& task_packet)
    {
        std::weak_ptr<lifetime_token> weak_lifetime = lifetime_;
        auto self = static_cast<Derived*>(this);
        // The app outlives the state machine, so this stays valid even once "self" dangles
        auto* app = &self->app();

        auto acked_func =
            [self, app, weak_lifetime](const protobuf::TaskPacket& msg,
                                       const goby::middleware::intervehicle::protobuf::AckData& ack)
        {
            goby::glog.is_verbose() &&
                goby::glog << group("statechart")
                           << "[iridium] Ack received for TaskPacket with id: " << msg.storm_id()
                           << ", ack: " << ack.ShortDebugString() << std::endl;

            // Deliberately outside if_alive: acks routinely arrive after we have left this
            // state, since an Iridium round trip can exceed data_offload_timeout_minutes.
            // Skipping this leaves the outbox file behind, so the same packet heads the
            // queue on every subsequent wake and starves everything behind it.
            app->complete_task_packet(msg);

            // only run if we're still in this state (and "self" is valid)
            if_alive(weak_lifetime,
                     [&]
                     {
                         if (!self->task_packets_outstanding())
                         {
                             goby::glog.is_verbose() &&
                                 goby::glog << group("statechart")
                                            << "[iridium] All TaskPackets sent and ack'd"
                                            << std::endl;
                             self->post_event(DataOffloadCompletedEvent());
                         }
                         else
                         {
                             // acks can arrive in any order with several in flight; just
                             // top the pipeline back up
                             self->fill_pipeline();
                         }
                     });
        };

        auto expired_func = [self, app, weak_lifetime](
                                const protobuf::TaskPacket& msg,
                                const goby::middleware::intervehicle::protobuf::ExpireData& expire)
        {
            goby::glog.is_warn() &&
                goby::glog
                    << group("statechart")
                    << "[iridium] Expiry received for TaskPacket with id: " << msg.storm_id()
                    << ", reason: "
                    << goby::middleware::intervehicle::protobuf::ExpireData::ExpireReason_Name(
                           expire.reason())
                    << std::endl;

            // Also outside if_alive: a packet that expires after its state has exited must
            // still be cleared from the in-flight set, or nothing republishes it for the
            // rest of this wake.
            app->task_packet_expired(msg, expire.reason());

            // only run if we're still in this state (and "self" is valid)
            if_alive(weak_lifetime,
                     [&]
                     {
                         // deferred reasons are picked up by the EvLoop retry instead
                         if (expire.reason() == goby::middleware::intervehicle::protobuf::
                                                    ExpireData::EXPIRED_TIME_TO_LIVE_EXCEEDED)
                             self->fill_pipeline();
                     });
        };

        // see comment in src/lib/intervehicle.h
        auto dummy_group_func = [](protobuf::TaskPacket&, const goby::middleware::Group&) {};
        goby::middleware::Publisher<protobuf::TaskPacket> task_packet_publisher(
            {}, dummy_group_func, acked_func, expired_func);

        self->machine().task_packets_in_flight().insert(task_packet.storm_id());
        self->machine().task_packets_deferred_until().erase(task_packet.storm_id());

        self->intervehicle().template publish<groups::task_packet>(task_packet,
                                                                   task_packet_publisher);
    }

    // use to track existence of this state for ack/expired functions that might be called
    // after we've left the state due to timeout
    std::shared_ptr<lifetime_token> lifetime_{std::make_shared<lifetime_token>()};

    // storm_ids this state waits on; unset means the whole queue (see
    // task_packets_outstanding())
    std::optional<std::set<int>> owned_task_packet_ids_;
};
