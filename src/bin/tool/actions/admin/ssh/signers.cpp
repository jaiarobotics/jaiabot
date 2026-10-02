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

#include <iostream>

#include "signers.h"

#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::ssh::SignersTool::SignersTool()
{
    const auto& prefix = app_cfg().comment_prefix();

    // ssh-keygen -Y verify reads this format: principals, then the key itself.
    // Options are deliberately not carried over - an authorized_keys option
    // restricts a login and means nothing to a signature.
    int emitted = 0;
    for (const auto& p : pk_manager_.pubkeys())
    {
        const auto& pubkey = p.second;
        if (pubkey.comment.rfind(prefix, 0) != 0)
            continue;

        std::cout << app_cfg().principal() << " " << pubkey.keytype << " " << pubkey.b64_key
                  << std::endl;
        ++emitted;
    }

    if (emitted == 0)
        glog.is_die() && glog << "No known key has a comment beginning '" << prefix
                              << "', so nothing could sign for " << app_cfg().principal()
                              << std::endl;

    quit(0);
}
