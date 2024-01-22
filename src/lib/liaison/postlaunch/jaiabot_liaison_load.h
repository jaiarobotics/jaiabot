#ifndef JAIABOT_LIAISON_LOAD_H
#define JAIABOT_LIAISON_LOAD_H

#include <vector>

#include "goby/zeromq/liaison/liaison_container.h"

extern "C"
{
    std::vector<goby::zeromq::LiaisonContainer*>
    goby3_liaison_load(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg);
}

#endif
