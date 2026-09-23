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
    // Publish several TaskPackets at once and let Goby's DynamicBuffer handle
    // retransmission, rather than sending one and waiting for its ack. A single Iridium
    // round trip has been measured at 33-176 s, so a serial send cannot drain a backlog
    // within data_offload_timeout_minutes.
    //
    // Held well below the hub-side task_packet_buffer max_queue (42) so our publications
    // cannot overflow it; an overflow expires the packet immediately and retrying on
    // that just churns.
    constexpr static std::size_t max_in_flight() { return 8; }

    // Retry delay for packets Goby could not buffer at all.
    constexpr static goby::time::SteadyClock::duration retry_interval()
    {
        return std::chrono::seconds(30);
    }

    void try_send_to_shore()
    {
        auto self = static_cast<Derived*>(this);
        if (self->machine().task_packet_queue().empty())
        {
            goby::glog.is_verbose() && goby::glog << group("statechart")
                                                  << "[iridium] No TaskPackets to send"
                                                  << std::endl;
            self->post_event(DataOffloadCompletedEvent());
            return;
        }

        fill_pipeline();
    }

    // Drives deferred retries; call from each state's EvLoop reaction. Unlike
    // try_send_to_shore() this never posts the completion event, so it is safe to call
    // before the state is otherwise ready to finish.
    void retry_pending_task_packets()
    {
        if (static_cast<Derived*>(this)->machine().task_packet_queue().empty())
            return;

        fill_pipeline();
    }

    void fill_pipeline()
    {
        auto self = static_cast<Derived*>(this);
        const auto now = goby::time::SteadyClock::now();

        std::vector<protobuf::TaskPacket> to_send;
        for (const auto& task_packet : self->machine().task_packet_queue())
        {
            if (in_flight_.size() + to_send.size() >= max_in_flight())
                break;
            if (in_flight_.count(task_packet.storm_id()))
                continue;

            auto deferred_it = deferred_until_.find(task_packet.storm_id());
            if (deferred_it != deferred_until_.end() && now < deferred_it->second)
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
                         self->in_flight_.erase(msg.storm_id());
                         self->deferred_until_.erase(msg.storm_id());

                         if (self->machine().task_packet_queue().empty())
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

        auto expired_func = [self, weak_lifetime](
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

            // only run if we're still in this state (and "self" is valid)
            if_alive(weak_lifetime,
                     [&]
                     {
                         self->in_flight_.erase(msg.storm_id());

                         switch (expire.reason())
                         {
                             case goby::middleware::intervehicle::protobuf::ExpireData::
                                 EXPIRED_TIME_TO_LIVE_EXCEEDED:
                                 // it was buffered but never ack'd in time - resend now
                                 self->fill_pipeline();
                                 break;

                             case goby::middleware::intervehicle::protobuf::ExpireData::
                                 EXPIRED_NO_SUBSCRIBERS:
                             case goby::middleware::intervehicle::protobuf::ExpireData::
                                 EXPIRED_BUFFER_OVERFLOW:
                                 // Goby could not buffer this at all and expires it with zero
                                 // latency. Republishing from here would re-expire on the next
                                 // poll and spin for as long as the condition lasts - which for
                                 // EXPIRED_NO_SUBSCRIBERS is the whole window after each wake,
                                 // while the hub's Iridium subscription is still coming up.
                                 // Let the EvLoop retry pick it up instead.
                                 self->deferred_until_[msg.storm_id()] =
                                     goby::time::SteadyClock::now() + retry_interval();
                                 break;
                         }
                     });
        };

        // see comment in src/lib/intervehicle.h
        auto dummy_group_func = [](protobuf::TaskPacket&, const goby::middleware::Group&) {};
        goby::middleware::Publisher<protobuf::TaskPacket> task_packet_publisher(
            {}, dummy_group_func, acked_func, expired_func);

        in_flight_.insert(task_packet.storm_id());
        deferred_until_.erase(task_packet.storm_id());

        self->intervehicle().template publish<groups::task_packet>(task_packet,
                                                                   task_packet_publisher);
    }

    // use to track existence of this state for ack/expired functions that might be called
    // after we've left the state due to timeout
    std::shared_ptr<lifetime_token> lifetime_{std::make_shared<lifetime_token>()};

    // storm_id of packets published to Goby and neither ack'd nor expired yet
    std::set<int> in_flight_;
    // storm_id -> earliest time to republish, for packets Goby could not buffer
    std::map<int, goby::time::SteadyClock::time_point> deferred_until_;
};
