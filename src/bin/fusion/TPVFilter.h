#include <vector>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/time/steady_clock.h>
#include <goby/middleware/marshalling/protobuf.h>
#include <goby/util/debug_logger/flex_ostream.h>

using namespace std;
using namespace goby::middleware::protobuf::gpsd;
using namespace goby::time;
using goby::glog;

struct TPVState {
    SteadyClock::time_point received_time;
    TimePositionVelocity tpv;
    SkyView sky;
};


class TPVFilter {
    public:

        TPVFilter(const int tpv_state_expiration_time_ms = 1000)
            : tpv_state_expiration_time_ms_(tpv_state_expiration_time_ms) {
        }

        void push_skyview(const SkyView& sky) {
            latest_skyview_ = sky;
        }

        void push_tpv(const TimePositionVelocity& tpv) {
            // Add new tpv state
            TPVState state;
            auto now = SteadyClock::now();
            state.received_time = now;
            state.tpv = tpv;
            state.sky = latest_skyview_;
            tpv_states_.push_back(state);

            // Remove old states, if we have more than one, (one old state is better than none)
            if (tpv_states_.size() > 1) {
                tpv_states_.erase(
                    std::remove_if(
                        tpv_states_.begin(),
                        tpv_states_.end(),
                        [this, now](const TPVState& old_state) {
                            auto age = now - old_state.received_time;
                            return age > std::chrono::milliseconds(tpv_state_expiration_time_ms_);
                        }),
                    tpv_states_.end());
            }
            
            // Sort by hdop
            std::sort(tpv_states_.begin(), tpv_states_.end(),
                    [](const TPVState& a, const TPVState& b) {
                        // No hdop means worst hdop
                        if (!a.sky.has_hdop()) return false;
                        if (!b.sky.has_hdop()) return true;
                        return a.sky.hdop() < b.sky.hdop();
                    });

        }

        const TPVState* best_tpv_state() const {
            if (tpv_states_.empty()) {
                return nullptr;
            } else {
                return &tpv_states_.front();
            }
        }

        int tpv_state_expiration_time_ms_{1000};

    private:
        SkyView latest_skyview_;
        vector<TPVState> tpv_states_;

};