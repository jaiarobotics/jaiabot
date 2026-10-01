// Shared CloudHub navigation. Caddy injects this into every proxied HTML page
// (run, sim, users, auth) and the landing page includes it directly.
//
// Authelia's portal is served with a strict CSP (script-src 'self';
// style-src 'self' + nonce), so everything here must stay in external files:
// no inline styles, no style attributes, no inline event handlers.
(function () {
    "use strict";

    if (document.getElementById("jaia-nav")) {
        return;
    }

    var SITE_LABELS = ["run", "sim", "users", "auth"];
    var hostParts = location.hostname.split(".");
    var site = SITE_LABELS.indexOf(hostParts[0]) >= 0 ? hostParts.shift() : "home";
    var base = hostParts.join(".");
    var path = location.pathname;
    var app = "";
    if (site === "run" || site === "sim") {
        app = path.indexOf("/jcu") === 0 ? "jcu" : path.indexOf("/jdv") === 0 ? "jdv" : "jcc";
    }
    var currentId = app ? site + "-" + app : site;

    function url(sub, p) {
        return "https://" + (sub ? sub + "." : "") + base + (p || "/");
    }

    // Groups mirror the Authelia access_control rules written by
    // jaia_configure_authelia.sh; null means any signed-in user.
    var GROUPS_SUPER_ADMIN = "super_admin";
    var SITES = [
        { id: "home", text: "Home", href: url("", "/"), groups: null },
        {
            id: "run",
            text: "Run",
            children: [
                { id: "run-jcc", text: "JCC", href: url("run"), groups: ["run"] },
                {
                    id: "run-jcu",
                    text: "JCU",
                    href: url("run", "/jcu/"),
                    groups: ["jcu_user", "jcu_advanced", "jcu_developer"],
                },
                { id: "run-jdv", text: "JDV", href: url("run", "/jdv/"), groups: ["jdv"] },
            ],
        },
        {
            id: "sim",
            text: "Sim",
            children: [
                { id: "sim-jcc", text: "JCC", href: url("sim"), groups: ["sim"] },
                { id: "sim-jcu", text: "JCU", href: url("sim", "/jcu/"), groups: ["sim"] },
                { id: "sim-jdv", text: "JDV", href: url("sim", "/jdv/"), groups: ["sim"] },
            ],
        },
        { id: "users", text: "Users", href: url("users"), groups: ["lldap_admin"] },
        { id: "auth", text: "Account", href: url("auth", "/settings"), groups: null },
    ];
    var LOGIN_URL = url("auth");
    var LOGOUT_URL = url("auth", "/logout?rd=" + encodeURIComponent(url("", "/")));

    // Who the user is, per Caddy's /_jaia/whoami. groups === null means unknown
    // (endpoint unreachable), in which case every link is shown.
    var identity = { user: "", name: "", groups: null, signedIn: false };

    function isAllowed(item) {
        if (item.children) {
            return item.children.some(isAllowed);
        }
        if (item.groups === null || identity.groups === null) {
            return true;
        }
        if (identity.groups.indexOf(GROUPS_SUPER_ADMIN) >= 0) {
            return true;
        }
        return item.groups.some(function (g) {
            return identity.groups.indexOf(g) >= 0;
        });
    }

    function findItem(id) {
        for (var i = 0; i < SITES.length; i++) {
            if (SITES[i].id === id) return SITES[i];
            var children = SITES[i].children || [];
            for (var j = 0; j < children.length; j++) {
                if (children[j].id === id) return children[j];
            }
        }
        return null;
    }

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (text) e.textContent = text;
        return e;
    }

    function link(item) {
        var a = el("a", "jaia-nav-link", item.text);
        a.href = item.href;
        if (item.id === currentId) {
            a.classList.add("jaia-nav-current");
            a.setAttribute("aria-current", "page");
        }
        return a;
    }

    function buildMenu() {
        var menu = el("nav", "jaia-nav-menu");
        menu.id = "jaia-nav-menu";
        menu.setAttribute("aria-label", "Jaia sites");

        var header = el("div", "jaia-nav-header");
        if (identity.signedIn) {
            header.appendChild(el("span", "jaia-nav-header-label", "Signed in as"));
            header.appendChild(el("span", "jaia-nav-user", identity.user));
        } else {
            header.appendChild(el("span", "jaia-nav-header-label", "Not signed in"));
        }
        menu.appendChild(header);

        var list = el("ul", "jaia-nav-list");
        SITES.forEach(function (item) {
            if (!isAllowed(item)) return;
            var li = el("li", "jaia-nav-item");
            if (item.children) {
                li.appendChild(el("span", "jaia-nav-group", item.text));
                var subs = el("span", "jaia-nav-children");
                item.children.forEach(function (child) {
                    if (isAllowed(child)) subs.appendChild(link(child));
                });
                li.appendChild(subs);
            } else {
                li.appendChild(link(item));
            }
            list.appendChild(li);
        });
        menu.appendChild(list);

        var footer = el("div", "jaia-nav-footer");
        var action = el("a", "jaia-nav-button", identity.signedIn ? "Log out" : "Log in");
        action.href = identity.signedIn ? LOGOUT_URL : LOGIN_URL;
        footer.appendChild(action);
        menu.appendChild(footer);
        return menu;
    }

    var root = el("div", "jaia-nav");
    root.id = "jaia-nav";

    var toggle = el("button", "jaia-nav-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Jaia navigation");
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "jaia-nav-menu");
    var logo = el("img", "jaia-nav-logo");
    logo.src = "/_jaia/logo.svg";
    logo.alt = "Jaia";
    toggle.appendChild(logo);
    var toggleUser = el("span", "jaia-nav-toggle-user");
    toggle.appendChild(toggleUser);
    root.appendChild(toggle);

    var menu = null;

    function setOpen(open) {
        if (open && !menu) {
            menu = buildMenu();
            root.appendChild(menu);
        }
        root.classList.toggle("jaia-nav-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        setOpen(!root.classList.contains("jaia-nav-open"));
    });
    document.addEventListener("click", function (event) {
        if (!root.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") setOpen(false);
    });

    // The landing page marks its own links with data-jaia-site so it can share
    // this access logic without any server-side templating.
    function applyToPage() {
        toggleUser.textContent = identity.signedIn ? identity.user : "";
        if (menu) {
            root.removeChild(menu);
            menu = null;
            if (root.classList.contains("jaia-nav-open")) setOpen(true);
        }
        var siteEls = document.querySelectorAll("[data-jaia-site]");
        for (var i = 0; i < siteEls.length; i++) {
            var item = findItem(siteEls[i].getAttribute("data-jaia-site"));
            if (!item) continue;
            if (item.href && siteEls[i].tagName === "A") siteEls[i].href = item.href;
            siteEls[i].hidden = !isAllowed(item);
        }
        var signedInEls = document.querySelectorAll("[data-jaia-signed-in]");
        for (var n = 0; n < signedInEls.length; n++) {
            signedInEls[n].hidden = !identity.signedIn;
        }
        // Stay hidden until whoami answers so a signed-in user never sees "Log in" flash
        var signedOutEls = document.querySelectorAll("[data-jaia-signed-out]");
        for (var p = 0; p < signedOutEls.length; p++) {
            signedOutEls[p].hidden = identity.signedIn || identity.groups === null;
        }
        var userEls = document.querySelectorAll("[data-jaia-user]");
        for (var k = 0; k < userEls.length; k++) {
            userEls[k].textContent = identity.user;
        }
        var logoutEls = document.querySelectorAll("[data-jaia-logout]");
        for (var m = 0; m < logoutEls.length; m++) {
            logoutEls[m].href = LOGOUT_URL;
        }
        var loginEls = document.querySelectorAll("[data-jaia-login]");
        for (var q = 0; q < loginEls.length; q++) {
            loginEls[q].href = LOGIN_URL;
        }
    }

    function loadIdentity() {
        fetch("/_jaia/whoami", {
            credentials: "same-origin",
            redirect: "manual",
            cache: "no-store",
        })
            .then(function (response) {
                if (response.status === 200) {
                    return response.text().then(function (text) {
                        var lines = text.split("\n");
                        identity.user = (lines[0] || "").trim();
                        identity.name = (lines[1] || "").trim();
                        identity.groups = (lines[2] || "")
                            .split(",")
                            .map(function (g) {
                                return g.trim();
                            })
                            .filter(Boolean);
                        identity.signedIn = identity.user !== "";
                    });
                }
                // An opaque redirect (to the portal) or 401/403 means no session
                if (
                    response.type === "opaqueredirect" ||
                    response.status === 401 ||
                    response.status === 403
                ) {
                    identity.groups = [];
                    identity.signedIn = false;
                }
            })
            .catch(function () {})
            .then(applyToPage);
    }

    function start() {
        document.body.appendChild(root);
        // Apps that mount on <body> (LLDAP) clear it after this runs
        new MutationObserver(function () {
            if (!root.isConnected && document.body) document.body.appendChild(root);
        }).observe(document.documentElement, { childList: true, subtree: true });
        applyToPage();
        loadIdentity();
    }

    if (document.body) {
        start();
    } else {
        document.addEventListener("DOMContentLoaded", start);
    }
})();
