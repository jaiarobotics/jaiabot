// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#include <regex>
#include <vector>

#include <boost/algorithm/string.hpp>
#include <goby/util/debug_logger.h>

#include "pubkeys.h"

using goby::glog;

jaiabot::apps::admin::ssh::PubKeyManager::PubKeyManager()
{
    // clang-format off
    std::vector<std::string> pubkeys = {
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIMBTII+4wTJ4VrDxVvljDShXUaxEeuBMByYe+kpzPH6WAAAABHNzaDo= jaia@root_yubikey19377650",
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIEgYJNPbLWHHjkd3a2b8OINZoPAlLgqjroKZelfESBpMAAAABHNzaDo= jaia@root_yubikey19377734",
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAILWQpc0cmWaXvwti8SdvLALbddQeeteUkkEUn4pMfmW1AAAABHNzaDo= jaia@root_yubikey19377746",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCWVm+RgEobZnz2gsOBBQ8jinPxmuroios5L0Jpb7XVw0/wr730JqIY4Pr7zipTTiwZSSuFCvT0vjAA2aQbw3witiPyhYpffXHtM6mpxvdj9U3dsTth2bbkolI28/J8P/AO8nUPsjh/Zack1a4vtVP+PJGSK9yHR54hkbBnDZ+MrjMpnHteTVAF2SEJF3IlpqeIpAja/qceflPL24LgMPq5rlY7f0K0xxT6YDPToRaZ/rNO+FgzW4ZaKOrU51TNX5WgN2AiiavyqKa3iVT/9VTo+HveWldoW1p9Ov4iCY6QfP2kiF7gfsxZZJ/Xpn99H3ya5SIng1Qs+gQ40vvKQVVT toby@yubikey16719472",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDBxM4LhQ6Kfohk6oMesU9iPYsqiu1bI6hXS0TWQSsqF3sZgTb5BWO4FuoDXrc49EeeG8fQv0UKeZKmEK/VcXlu/YbHtirl0DYcsIA1SEBoTWEvwTN7SNf4hA9kDZH4WB+xJq2Ob+qmcRDmbVSovE9WSJUujJdYkZuuFl7w6j/UDys8waxV0vlw9FqY6bN/slxr26xY7CUwDygljP+b/VDzn4WNBZGLP8Xlb5vMtw9Gg5Jr0jH+IdVXpPtqhFa2zlWhpKTHq0mx7w6iKVaa1NZVyOX1Jlodml1NTted3P73K6dQ8g/SlKBTUvO/en6R+ZUpJFY3QvO/w5KgTl6d3v17 toby@yubikey16719053",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDkhjS74aGshxZcl2yTzJIDlxhVdA4aeMdSwHyXNolNzem5kowIrBp5/twQmaUPpUegk/fy8PSSB36qoCEde+8saFfYKKMKW/u4WApWs8nrKljBJg+tAPXwMdkowhIaFM2FNoo8GGa9LsssaCHNG8McYGS5IBjoU2+xlIw+Wo5w9fVLNpp+uXJopO4GFsEXYHj5ZnCUFTxAVrHcVVv3rBOdZ6acrPoayi3SExhSWzKpG9OE9r6Qwip+TT6LuBVr7fzExSFl6dynJhjXbyNuTHQFLRgt2MaRb2Zcfmcvb7o4KVO3cuIDQ/c/gwlk1x+9KWKllExEaUXIO4etlTgSoZUF toby@yubikey16718427"
    };
    // clang-format on
    for (const auto k : pubkeys)
    {
        jaiabot::apps::admin::ssh::PubKeyManager::PubKey pubkey;
        if (validate_and_parse_pubkey(k, pubkey))
        {
            pubkeys_.insert(std::make_pair(pubkey.comment, pubkey));
        }
    }
}

bool jaiabot::apps::admin::ssh::PubKeyManager::validate_and_parse_pubkey(
    const std::string& key, jaiabot::apps::admin::ssh::PubKeyManager::PubKey& pubkey)
{
    // should be 3 or 4 parts, check that the center is base64
    std::vector<std::string> keyparts;
    boost::split(keyparts, key, boost::is_any_of(" "));
    if (keyparts.size() != 3 && keyparts.size() != 4)
    {
        glog.is_warn() &&
            glog << "Invalid OpenSSH pubkey string, expected 3 or 4 space delimited strings: "
                 << key << std::endl;
        return false;
    }

    if (keyparts.size() == 3)
    {
        pubkey.keytype = keyparts[0];
        pubkey.b64_key = keyparts[1];
        pubkey.comment = keyparts[2];
    }
    else
    {
        pubkey.options = keyparts[0];
        pubkey.keytype = keyparts[1];
        pubkey.b64_key = keyparts[2];
        pubkey.comment = keyparts[3];
    }

    const std::regex b64_regex("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$");
    if (!std::regex_match(pubkey.b64_key, b64_regex))
    {
        glog.is_warn() &&
            glog << "Invalid OpenSSH pubkey string, key must be valid base64 encoded string: "
                 << key << std::endl;
        return false;
    }
    return true;
}
