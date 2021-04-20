#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/example.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase =
    goby::zeromq::SingleThreadApplication<jaiabot::config::SingleThreadPattern>;

namespace jaiabot
{
namespace apps
{
class SingleThreadPattern : public ApplicationBase
{
  public:
    SingleThreadPattern() : ApplicationBase(1.0 / (10.0 * si::seconds)) {}

  private:
    void loop() override;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::SingleThreadPattern>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::SingleThreadPattern>(argc,
                                                                                          argv));
}

void jaiabot::apps::SingleThreadPattern::loop()
{
    // called at frequency passed to SingleThreadApplication (ApplicationBase)
    glog.is_verbose() && glog << "Loop!" << std::endl;
}
