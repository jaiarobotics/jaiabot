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

        std::weak_ptr<lifetime_token> weak_lifetime = lifetime_;
        auto self = static_cast<Derived*>(this);
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

        auto expired_func = [self, weak_lifetime](
                                const protobuf::TaskPacket& msg,
                                const goby::middleware::intervehicle::protobuf::ExpireData& expire)
        {
            goby::glog.is_warn() &&
                goby::glog << group("statechart")
                           << "[iridium] Expiry received for TaskPacket with id: " << msg.storm_id()
                           << std::endl;

            // only run if we're still in this state (and "self" is valid)
            if_alive(weak_lifetime,
                     [&]
                     {
                         self->try_send_to_shore(); // don't give up - retry
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

    // use to track existence of this state for ack/expired functions that might be called
    // after we've left the state due to timeout
    std::shared_ptr<lifetime_token> lifetime_{std::make_shared<lifetime_token>()};
};
