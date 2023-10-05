#include "liaison_jaiabot.h"

#include "jaiabot_liaison_load.h"

extern "C"
{
    std::vector<goby::zeromq::LiaisonContainer*>
    goby3_liaison_load(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg)
    {
        std::vector<goby::zeromq::LiaisonContainer*> containers;
        containers.push_back(new jaiabot::LiaisonJaiabot(cfg));
        return containers;
    }
}
