/*
 * Jaia navigation header.
 *
 * This file is a Go (Caddy) template, served by the CloudHub Caddy instance
 * from /_jaia/nav/jaia-nav.js on every Authelia protected site (auth., users.,
 * run., sim.) and injected into every HTML response by the Caddy
 * "replace_response" handler (see scripts/system/jaia_configure_authelia.sh).
 *
 * The header is rendered into a shadow root so that neither the application
 * CSS nor the header CSS can clash with each other.
 */
(function () {
    "use strict";

    if (window.__jaiaNavLoaded) return;
    window.__jaiaNavLoaded = true;

    // Rendered by Caddy's "templates" handler from the headers that Authelia
    // provides via forward_auth (copy_headers Remote-User Remote-Groups ...).
    var user = {{ .Req.Header.Get "Remote-User" | toJson }};
    var groupHeader = {{ .Req.Header.Get "Remote-Groups" | toJson }};

    var groups = groupHeader
        .split(",")
        .map(function (group) {
            return group.trim();
        })
        .filter(function (group) {
            return group.length > 0;
        });

    // The sites are always served as <service>.<base_uri>, so the base URI is
    // the current hostname without its first label.
    var baseUri = window.location.hostname.split(".").slice(1).join(".");

    function inAnyGroup(allowed) {
        return allowed.some(function (group) {
            return groups.indexOf(group) !== -1;
        });
    }

    // Mirrors the access_control rules in the Authelia configuration, so that
    // only the links the user can actually follow are shown.
    var links = [
        { name: "JCC", href: "https://run." + baseUri + "/", groups: ["run"] },
        {
            name: "JCU",
            href: "https://run." + baseUri + "/jcu",
            groups: ["jcu_user", "jcu_advanced", "jcu_developer"],
        },
        { name: "JDV", href: "https://run." + baseUri + "/jdv", groups: ["jdv"] },
        { name: "VirtualFleet", href: "https://sim." + baseUri + "/", groups: ["sim"] },
        { name: "Users", href: "https://users." + baseUri + "/", groups: ["lldap_admin"] },
        // everyone can manage their own account on the Authelia portal
        { name: "Account", href: "https://auth." + baseUri + "/settings", groups: null },
    ];

    var host = document.createElement("div");
    host.id = "jaia-nav";
    host.style.cssText =
        "all: initial; position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;";

    var root = host.attachShadow({ mode: "closed" });

    var style = document.createElement("style");
    style.textContent = [
        ":host { all: initial; }",
        "nav { align-items: center; background: #0e1013; border-bottom: 1px solid #2c3238;",
        "      box-sizing: border-box; color: #e7ebee; display: flex; font-family: sans-serif;",
        "      font-size: 14px; gap: 16px; height: 40px; padding: 0 12px; }",
        "img { height: 24px; width: auto; }",
        "a { color: #e7ebee; text-decoration: none; white-space: nowrap; }",
        "a:hover { color: #00a8e8; text-decoration: underline; }",
        ".spacer { flex: 1 1 auto; }",
        ".user { color: #9aa5ad; white-space: nowrap; }",
    ].join("\n");
    root.appendChild(style);

    var nav = document.createElement("nav");

    var logo = document.createElement("img");
    logo.src = "/_jaia/nav/jaia-only-logo.png";
    logo.alt = "Jaia";
    nav.appendChild(logo);

    links.forEach(function (link) {
        if (link.groups !== null && !inAnyGroup(link.groups.concat(["super_admin"]))) return;
        var anchor = document.createElement("a");
        anchor.href = link.href;
        anchor.textContent = link.name;
        nav.appendChild(anchor);
    });

    var spacer = document.createElement("div");
    spacer.className = "spacer";
    nav.appendChild(spacer);

    if (user.length > 0) {
        var username = document.createElement("span");
        username.className = "user";
        username.textContent = user;
        nav.appendChild(username);
    }

    var logout = document.createElement("a");
    logout.href = "https://auth." + baseUri + "/logout";
    logout.textContent = "Logout";
    nav.appendChild(logout);

    root.appendChild(nav);

    function install() {
        document.body.appendChild(host);
        // offset the application content so that it isn't hidden by the header
        var offset = document.createElement("style");
        offset.textContent = "body { margin-top: 40px !important; }";
        document.head.appendChild(offset);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install);
    } else {
        install();
    }
})();
