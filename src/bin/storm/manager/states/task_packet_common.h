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

    // Unset means wait on the whole queue (DataOffload); a set means only those ids, so
    // self test isn't blocked on a backlog replayed from a previous wake.
    bool task_packets_outstanding()
    {
        const auto& queue = static_cast<Derived*>(this)->machine().task_packet_queue();
        if (!owned_task_packet_ids_)
            return !queue.empty();

        return std::any_of(queue.begin(), queue.end(),
                           [this](const protobuf::TaskPacket& task_packet)
                           { return owned_task_packet_ids_->count(task_packet.storm_id()) > 0; });
    }

    // Drives deferred retries from each state's EvLoop reaction. Never posts the
    // completion event; each state checks that itself.
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

        auto consider = [&](const protobuf::TaskPacket& task_packet)
        {
            if (in_flight.size() + to_send.size() >= machine.max_task_packets_in_flight())
                return;
            if (in_flight.count(task_packet.storm_id()))
                return;

            auto deferred_it = deferred_until.find(task_packet.storm_id());
            if (deferred_it != deferred_until.end() && now < deferred_it->second)
                return;

            to_send.push_back(task_packet);
        };

        auto is_owned = [this](const protobuf::TaskPacket& task_packet)
        { return owned_task_packet_ids_->count(task_packet.storm_id()) > 0; };

        // Own packets claim slots first: the cap is shared and a replayed backlog sits
        // ahead of them, so otherwise self test still waits on backlog round trips.
        if (owned_task_packet_ids_)
            for (const auto& task_packet : machine.task_packet_queue())
                if (is_owned(task_packet))
                    consider(task_packet);

        // then fill any slots left over with the rest of the queue, oldest first
        for (const auto& task_packet : machine.task_packet_queue())
            if (!owned_task_packet_ids_ || !is_owned(task_packet))
                consider(task_packet);

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
            // Outside if_alive: acks often arrive after we've left the state, and skipping
            // this leaves the outbox file to head the queue on every subsequent wake.
            const bool dequeued = app->complete_task_packet(msg);

            // Goby acks each retransmitted copy, so keep repeats out of the verbose log.
            if (dequeued)
                goby::glog.is_verbose() && goby::glog
                                               << group("statechart")
                                               << "[iridium] Ack received for TaskPacket with id: "
                                               << msg.storm_id()
                                               << ", ack: " << ack.ShortDebugString() << std::endl;
            else
                goby::glog.is_debug2() &&
                    goby::glog << group("statechart")
                               << "[iridium] Repeat ack for already-completed TaskPacket "
                                  "with id: "
                               << msg.storm_id() << std::endl;

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
                             // acks can arrive in any order; just top the pipeline back up
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

            // Also outside if_alive, or a packet expiring after its state exits stays
            // marked in flight and is never republished this wake.
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

        // lets duplicate publications be counted per storm_id from the glog alone
        goby::glog.is_verbose() && goby::glog << group("statechart")
                                              << "[iridium] Publishing TaskPacket with id: "
                                              << task_packet.storm_id() << std::endl;

        self->machine().task_packets_in_flight().insert(task_packet.storm_id());
        self->machine().task_packets_deferred_until().erase(task_packet.storm_id());

        self->intervehicle().template publish<groups::task_packet>(task_packet,
                                                                   task_packet_publisher);
    }

    // use to track existence of this state for ack/expired functions that might be called
    // after we've left the state due to timeout
    std::shared_ptr<lifetime_token> lifetime_{std::make_shared<lifetime_token>()};

    // storm_ids this state waits on; unset means the whole queue
    std::optional<std::set<int>> owned_task_packet_ids_;
};
