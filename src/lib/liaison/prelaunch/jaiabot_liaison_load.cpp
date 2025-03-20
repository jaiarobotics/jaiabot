#include "liaison_upgrade.h"

#include "jaiabot_liaison_load.h"

extern "C"
{
    std::vector<std::unique_ptr<goby::zeromq::LiaisonContainer>>
    goby3_liaison_load(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg)
    {
        std::vector<std::unique_ptr<goby::zeromq::LiaisonContainer>> containers;
        containers.emplace_back(std::make_unique<jaiabot::LiaisonUpgrade>(cfg));
        return containers;
    }
}
