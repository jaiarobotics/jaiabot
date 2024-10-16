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

    // list of permanently revoked pubkeys (e.g., lost or stolen Yubikeys)
    std::vector<std::string> revoked_pubkeys = {
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOJmloXO9vgefQef+j3xqvPpVhCqHm5uYurkSmD5wIKp testkey1"
    };
    // clang-format on
    for (const auto k : revoked_pubkeys)
    {
        jaiabot::apps::admin::ssh::PubKeyManager::PubKey pubkey;
        if (validate_and_parse_pubkey(k, pubkey))
        {
            revoked_pubkeys_.insert(std::make_pair(pubkey.comment, pubkey));
        }
    }

    // clang-format off

    // valid keys known by us for shorthand (comment field) use
    std::vector<std::string> pubkeys = {
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIMBTII+4wTJ4VrDxVvljDShXUaxEeuBMByYe+kpzPH6WAAAABHNzaDo= jaia@root_yubikey19377650",
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIEgYJNPbLWHHjkd3a2b8OINZoPAlLgqjroKZelfESBpMAAAABHNzaDo= jaia@root_yubikey19377734",
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAILWQpc0cmWaXvwti8SdvLALbddQeeteUkkEUn4pMfmW1AAAABHNzaDo= jaia@root_yubikey19377746",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCWVm+RgEobZnz2gsOBBQ8jinPxmuroios5L0Jpb7XVw0/wr730JqIY4Pr7zipTTiwZSSuFCvT0vjAA2aQbw3witiPyhYpffXHtM6mpxvdj9U3dsTth2bbkolI28/J8P/AO8nUPsjh/Zack1a4vtVP+PJGSK9yHR54hkbBnDZ+MrjMpnHteTVAF2SEJF3IlpqeIpAja/qceflPL24LgMPq5rlY7f0K0xxT6YDPToRaZ/rNO+FgzW4ZaKOrU51TNX5WgN2AiiavyqKa3iVT/9VTo+HveWldoW1p9Ov4iCY6QfP2kiF7gfsxZZJ/Xpn99H3ya5SIng1Qs+gQ40vvKQVVT toby@yubikey16719472",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDkhjS74aGshxZcl2yTzJIDlxhVdA4aeMdSwHyXNolNzem5kowIrBp5/twQmaUPpUegk/fy8PSSB36qoCEde+8saFfYKKMKW/u4WApWs8nrKljBJg+tAPXwMdkowhIaFM2FNoo8GGa9LsssaCHNG8McYGS5IBjoU2+xlIw+Wo5w9fVLNpp+uXJopO4GFsEXYHj5ZnCUFTxAVrHcVVv3rBOdZ6acrPoayi3SExhSWzKpG9OE9r6Qwip+TT6LuBVr7fzExSFl6dynJhjXbyNuTHQFLRgt2MaRb2Zcfmcvb7o4KVO3cuIDQ/c/gwlk1x+9KWKllExEaUXIO4etlTgSoZUF toby@yubikey16718427",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDBxM4LhQ6Kfohk6oMesU9iPYsqiu1bI6hXS0TWQSsqF3sZgTb5BWO4FuoDXrc49EeeG8fQv0UKeZKmEK/VcXlu/YbHtirl0DYcsIA1SEBoTWEvwTN7SNf4hA9kDZH4WB+xJq2Ob+qmcRDmbVSovE9WSJUujJdYkZuuFl7w6j/UDys8waxV0vlw9FqY6bN/slxr26xY7CUwDygljP+b/VDzn4WNBZGLP8Xlb5vMtw9Gg5Jr0jH+IdVXpPtqhFa2zlWhpKTHq0mx7w6iKVaa1NZVyOX1Jlodml1NTted3P73K6dQ8g/SlKBTUvO/en6R+ZUpJFY3QvO/w5KgTl6d3v17 toby@yubikey16719053",
        // example repair key - can only run fleet-config.sh
        "restrict,pty,command=\"/usr/share/jaiabot/config/fleet/fleet-config.sh\" ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCyo/c0BMJpE8bzwOQk15xBn3fUhk6Gg8xqIH+ZATw8z3IaYH/5UYeCi8wjwjI1gF61zFlr0BSBuRctNRr1+P88sdeyDAinnplhBXAWBKm5aaC1gjM+IPI6LB8RytxOSMp/w/MRn6meeEsMkIr6+v2qAhBY6vtUObHTu1JE2gB+Cckq0zHdhtUb/tm063i3DfsAaftEAZLzwGS1Ad3jBe+bhydAUSPYxc7njF+meHJTqyzg1Cc9C0hb8bfsOG+LZF/+ap60UaM49ko2MTulvwKABzN5l9vvS4d5RycnkTwIGoY984TB/DrMc6HEqxooz51T4+7ltlgQ+VacgU0xE1f/ jaia@repair_test1"
        
    };
    // clang-format on
    for (const auto k : pubkeys)
    {
        jaiabot::apps::admin::ssh::PubKeyManager::PubKey pubkey;
        if (validate_and_parse_pubkey(k, pubkey))
        {
            for (const auto& p : revoked_pubkeys_)
            {
                if (p.second.b64_key == pubkey.b64_key)
                    glog.is_die() && glog << "Compiled key: " + k + " is in the revoked list"
                                          << std::endl;
            }

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
    if (keyparts.size() < 3)
    {
        glog.is_warn() &&
            glog << "Invalid OpenSSH pubkey string, expected 3 or more space delimited strings: "
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
        int i = 0;
        for (; i < keyparts.size() - 3; ++i) pubkey.options += keyparts[i] + " ";
        boost::trim(pubkey.options);
        pubkey.keytype = keyparts[i++];
        pubkey.b64_key = keyparts[i++];
        pubkey.comment = keyparts[i++];
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

std::pair<bool, jaiabot::apps::admin::ssh::PubKeyManager::PubKey>
jaiabot::apps::admin::ssh::PubKeyManager::find(const std::string& pubkey_or_comment)
{
    // try pubkey command line parameter as comment first
    if (pubkeys_.count(pubkey_or_comment))
        return std::make_pair(true, pubkeys_.at(pubkey_or_comment));

    PubKey pubkey;
    // try full key
    if (validate_and_parse_pubkey(pubkey_or_comment, pubkey))
    {
        // make sure this key hasn't been revoked
        for (const auto& p : revoked_pubkeys_)
        {
            if (p.second.b64_key == pubkey.b64_key)
                glog.is_die() && glog << "Pubkey is REVOKED: " << pubkey_or_comment << std::endl;
        }
        return std::make_pair(true, pubkey);
    }

    return std::make_pair(false, pubkey);
}
