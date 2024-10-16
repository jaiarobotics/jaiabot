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

#ifndef JAIABOT_SRC_BIN_TOOL_ACTIONS_ADMIN_SSH_PUBKEYS_H
#define JAIABOT_SRC_BIN_TOOL_ACTIONS_ADMIN_SSH_PUBKEYS_H

#include <map>
#include <string>

namespace jaiabot
{
namespace apps
{
namespace admin
{
namespace ssh
{
class PubKeyManager
{
  public:
    PubKeyManager();
    ~PubKeyManager(){};

    struct PubKey
    {
        std::string options;
        std::string keytype;
        std::string b64_key;
        std::string comment;

        std::string to_str() const
        {
            std::string s;
            if (!options.empty())
                s += options + " ";
            s += keytype + " " + b64_key + " " + comment;
            return s;
        }
    };

    std::pair<bool, PubKey> find(const std::string& pubkey_or_comment);

    const std::map<std::string, PubKey>& revoked_pubkeys() const { return revoked_pubkeys_; }
    const std::map<std::string, PubKey>& pubkeys() const { return pubkeys_; }

    static bool validate_and_parse_pubkey(const std::string& key,
                                          jaiabot::apps::admin::ssh::PubKeyManager::PubKey& pubkey);

  private:
    // map of "comment" to Pubkey
    std::map<std::string, PubKey> pubkeys_;
    // map of "comment" to revoked Pubkeys
    std::map<std::string, PubKey> revoked_pubkeys_;
};

} // namespace ssh
} // namespace admin
} // namespace apps
} // namespace jaiabot

#endif
