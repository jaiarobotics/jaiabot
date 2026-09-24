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
        if (static_cast<Derived*>(this)->machine().task_packet_queue().empty())
        {
            goby::glog.is_verbose() && goby::glog << group("statechart")
                                                  << "[iridium] No TaskPackets to send"
                                                  << std::endl;
            static_cast<Derived*>(this)->post_event(DataOffloadCompletedEvent());
            return;
        }

        // start tracking a new publication: expiries from any earlier one are ignored
        const int attempt = ++publish_attempt_;
        expired_links_.clear();
        retry_pending_ = false;

        std::weak_ptr<lifetime_token> weak_lifetime = lifetime_;
        auto self = static_cast<Derived*>(this);
        auto common = this;
        auto acked_func =
            [self, weak_lifetime](const protobuf::TaskPacket& msg,
                                  const goby::middleware::intervehicle::protobuf::AckData& ack)
        {
            goby::glog.is_verbose() &&
                goby::glog << group("statechart")
                           << "[iridium] Ack received for TaskPacket with id: " << msg.storm_id()
                           << ", ack: " << ack.ShortDebugString() << std::endl;

            // only run if we're still in this state (and "self" is valid)
            if_alive(weak_lifetime,
                     [&]
                     {
                         auto& tp_queue = self->machine().task_packet_queue();
                         self->app().acknowledge_task_packet(msg);
                         std::erase(tp_queue, msg);
                         if (tp_queue.empty())
                         {
                             goby::glog.is_verbose() &&
                                 goby::glog << group("statechart")
                                            << "[iridium] All TaskPackets sent and ack'd"
                                            << std::endl;
                             self->post_event(DataOffloadCompletedEvent());
                         }
                         else
                         {
                             self->try_send_to_shore();
                         }
                     });
        };

        auto expired_func =
            [common, weak_lifetime, attempt](
                const protobuf::TaskPacket& msg,
                const goby::middleware::intervehicle::protobuf::ExpireData& expire)
        {
            goby::glog.is_warn() &&
                goby::glog << group("statechart")
                           << "[iridium] Expiry received for TaskPacket with id: " << msg.storm_id()
                           << ", reason: "
                           << goby::middleware::intervehicle::protobuf::ExpireData::ExpireReason_Name(
                                  expire.reason())
                           << ", link: " << expire.header().ShortDebugString() << std::endl;

            // goby itself retransmits a queued ack_required message until it is acked or its
            // ttl runs out, so TTL/overflow expiries are final. But a copy expired because no
            // subscriber was known yet (e.g. right after waking, before the hub's subscription
            // has been learned) is simply dropped, so it may need to be published again.
            if (expire.reason() !=
                goby::middleware::intervehicle::protobuf::ExpireData::EXPIRED_NO_SUBSCRIBERS)
                return;

            if_alive(weak_lifetime,
                     [&]
                     {
                         if (attempt != common->publish_attempt_)
                             return;
                         for (auto link : expire.header().dest())
                             common->expired_links_.insert(link);
                         if (!common->retry_pending_)
                         {
                             common->retry_pending_ = true;
                             common->next_retry_time_ =
                                 goby::time::SteadyClock::now() + no_subscriber_retry_delay;
                         }
                     });
        };

        // see comment in src/lib/intervehicle.h
        auto dummy_group_func = [](protobuf::TaskPacket&, const goby::middleware::Group&) {};
        goby::middleware::Publisher<protobuf::TaskPacket> task_packet_publisher(
            {}, dummy_group_func, acked_func, expired_func);

        static_cast<Derived*>(this)->intervehicle().template publish<groups::task_packet>(
            static_cast<Derived*>(this)->machine().task_packet_queue().front(),
            task_packet_publisher);
    }

    // call from the containing state's EvLoop handler
    void retry_send_if_due()
    {
        if (!retry_pending_ || goby::time::SteadyClock::now() < next_retry_time_)
            return;

        const auto& subscribed_links =
            static_cast<Derived*>(this)->machine().task_packet_subscribed_links();

        // no subscription report seen yet, so we can't tell whether some link is still
        // delivering this packet; reports are periodic, so check again later
        if (subscribed_links.empty())
        {
            next_retry_time_ = goby::time::SteadyClock::now() + no_subscriber_retry_delay;
            return;
        }

        // a link that has a subscriber and didn't expire this packet is still delivering it
        // (e.g. XBee/WiFi expired while out of range but Iridium is sending): don't duplicate
        for (const auto& [link, subscribed] : subscribed_links)
        {
            if (subscribed && !expired_links_.count(link))
            {
                retry_pending_ = false;
                return;
            }
        }

        goby::glog.is_warn() && goby::glog << group("statechart")
                                           << "[iridium] No link is delivering the TaskPacket, "
                                              "publishing it again"
                                           << std::endl;
        try_send_to_shore();
    }

    // use to track existence of this state for ack/expired functions that might be called
    // after we've left the state due to timeout
    std::shared_ptr<lifetime_token> lifetime_{std::make_shared<lifetime_token>()};

  private:
    static constexpr auto no_subscriber_retry_delay = std::chrono::seconds(30);

    int publish_attempt_{0};
    std::set<int> expired_links_;
    bool retry_pending_{false};
    goby::time::SteadyClock::time_point next_retry_time_{goby::time::SteadyClock::now()};
};
