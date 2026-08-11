add_jaiabot_application(TARGET jaia
  PROTOS config.proto
    actions/version.proto
    actions/ctl.proto
    actions/ssh.proto
    actions/ping.proto
    actions/admin.proto
    actions/admin/debconf_get.proto
    actions/admin/debconf_set.proto
    actions/admin/ssh.proto
    actions/admin/ssh/add.proto
    actions/admin/ssh/rm.proto
    actions/admin/ssh/list.proto
    actions/admin/ssh/clear.proto
    actions/admin/ssh/known.proto
    actions/admin/fleet.proto
    actions/admin/fleet/validate.proto
    actions/admin/fleet/vpn_authorize.proto
  SOURCES jaia_tool.cpp
    actions/version.cpp
    actions/ctl.cpp
    actions/ssh.cpp
    actions/ping.cpp
    actions/admin.cpp
    actions/admin/debconf_get.cpp
    actions/admin/debconf_set.cpp
    actions/admin/ssh.cpp
    actions/admin/ssh/add.cpp
    actions/admin/ssh/rm.cpp
    actions/admin/ssh/pubkeys.cpp
    actions/admin/ssh/list.cpp
    actions/admin/ssh/clear.cpp
    actions/admin/ssh/known.cpp
    actions/admin/fleet.cpp
    actions/admin/fleet/validate.cpp
    actions/admin/fleet/vpn_authorize.cpp
  LINK_LIBRARIES goby jaiabot_messages
)
