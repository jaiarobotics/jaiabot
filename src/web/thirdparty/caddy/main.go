// Caddy with the replace-response plugin, which injects the CloudHub's shared
// navigation into every proxied page. Built into the jaiabot-caddy package so a
// CloudHub's first boot needs nothing from caddyserver.com.
package main

import (
	caddycmd "github.com/caddyserver/caddy/v2/cmd"

	_ "github.com/caddyserver/caddy/v2/modules/standard"
	_ "github.com/caddyserver/replace-response"
)

func main() {
	caddycmd.Main()
}
