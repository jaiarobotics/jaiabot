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
    var LOGIN_URL = url(
        "auth",
        "/?rd=" + encodeURIComponent(site === "auth" ? url("", "/") : location.href)
    );
    var LOGOUT_URL = url("auth", "/logout?rd=" + encodeURIComponent(url("", "/")));

    // Who the user is, per Caddy's /_jaia/whoami. groups === null means unknown
    // (endpoint unreachable), in which case every link is shown.
    var identity = { user: "", name: "", groups: null, signedIn: false };

    // On the portal: who has given a password but not yet a second factor,
    // e.g. after registering their first device.
    var partialUser = "";

    // Whether the VirtualFleet answers, per /_jaia/sim; null until known.
    // It only runs once someone starts it from JCU.
    var simRunning = null;
    var SIM_POLL_MS = 15000;

    function isAllowed(item) {
        if (item.children) {
            return item.children.some(isAllowed);
        }
        if (identity.groups === null) {
            return true;
        }
        if (!identity.signedIn) {
            return false;
        }
        if (item.groups === null || identity.groups.indexOf(GROUPS_SUPER_ADMIN) >= 0) {
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

    function simHint() {
        return isAllowed(findItem("run-jcu"))
            ? "The VirtualFleet isn't running. Start it from Run \u2192 JCU (VirtualFleet section)."
            : "The VirtualFleet isn't running. Ask an administrator to start it.";
    }

    function buildMenu() {
        var menu = el("nav", "jaia-nav-menu");
        menu.id = "jaia-nav-menu";
        menu.setAttribute("aria-label", "Jaia sites");

        var header = el("div", "jaia-nav-header");
        if (identity.signedIn) {
            header.appendChild(el("span", "jaia-nav-header-label", "Signed in as"));
            header.appendChild(el("span", "jaia-nav-user", identity.user));
        } else if (partialUser) {
            header.appendChild(el("span", "jaia-nav-header-label", "Signing in as"));
            header.appendChild(el("span", "jaia-nav-user", partialUser));
            header.appendChild(el("span", "jaia-nav-header-label", "Two-factor step not done yet"));
        } else {
            header.appendChild(el("span", "jaia-nav-header-label", "Not signed in"));
        }
        menu.appendChild(header);

        var list = el("ul", "jaia-nav-list");
        SITES.forEach(function (item) {
            if (!isAllowed(item)) return;
            var li = el("li", "jaia-nav-item");
            var off = item.id === "sim" && simRunning === false;
            if (off) {
                li.classList.add("jaia-nav-item-off");
                li.title = simHint();
            }
            if (item.children) {
                li.appendChild(el("span", "jaia-nav-group", item.text));
                var subs = el("span", "jaia-nav-children");
                if (off) {
                    subs.appendChild(el("span", "jaia-nav-off", "Not running"));
                } else {
                    item.children.forEach(function (child) {
                        if (isAllowed(child)) subs.appendChild(link(child));
                    });
                }
                li.appendChild(subs);
            } else {
                li.appendChild(link(item));
            }
            list.appendChild(li);
        });
        if (list.children.length) menu.appendChild(list);

        var footer = el("div", "jaia-nav-footer");
        var action = el("a", "jaia-nav-button", identity.signedIn ? "Log out" : "Log in");
        action.href = identity.signedIn ? LOGOUT_URL : LOGIN_URL;
        if (partialUser && !identity.signedIn) {
            action.textContent = "Finish signing in";
            footer.appendChild(action);
            var logout = el("a", "jaia-nav-secondary", "Log out");
            logout.href = LOGOUT_URL;
            footer.appendChild(logout);
        } else {
            footer.appendChild(action);
        }
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
    logo.src = "/_jaia/cloud.svg";
    logo.alt = "Jaia";
    toggle.appendChild(logo);
    var toggleFleet = el("span", "jaia-nav-toggle-fleet");
    toggle.appendChild(toggleFleet);
    var toggleUser = el("span", "jaia-nav-toggle-user");
    toggle.appendChild(toggleUser);
    root.appendChild(toggle);

    var menu = null;

    function setOpen(open) {
        if (open && !root.classList.contains("jaia-nav-open")) loadSim();
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
        if (site === "home" && identity.groups !== null && !identity.signedIn) {
            location.replace(LOGIN_URL);
            return;
        }
        toggleUser.textContent = identity.signedIn ? identity.user : partialUser;
        applyFinishBanner();
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
        var userEls = document.querySelectorAll("[data-jaia-user]");
        for (var k = 0; k < userEls.length; k++) {
            userEls[k].textContent = identity.user;
        }
        var logoutEls = document.querySelectorAll("[data-jaia-logout]");
        for (var m = 0; m < logoutEls.length; m++) {
            logoutEls[m].href = LOGOUT_URL;
        }
        applySimToPage();
    }

    // Pages mark the Sim card (data-jaia-sim), its status badge, and what to
    // show when it is down: how to start it, or whom to ask.
    function applySimToPage() {
        var canStart = isAllowed(findItem("run-jcu"));
        var cards = document.querySelectorAll("[data-jaia-sim]");
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle("site-off", simRunning === false);
            var links = cards[i].querySelectorAll(".site-title a, .site-links a");
            for (var j = 0; j < links.length; j++) {
                if (simRunning === false) {
                    links[j].setAttribute("aria-disabled", "true");
                    links[j].tabIndex = -1;
                } else {
                    links[j].removeAttribute("aria-disabled");
                    links[j].removeAttribute("tabindex");
                }
            }
        }
        var badges = document.querySelectorAll("[data-jaia-sim-status]");
        for (var b = 0; b < badges.length; b++) {
            badges[b].hidden = simRunning === null;
            badges[b].textContent = simRunning ? "Running" : "Not running";
            badges[b].classList.toggle("site-status-up", simRunning === true);
        }
        var downEls = document.querySelectorAll("[data-jaia-sim-down]");
        for (var d = 0; d < downEls.length; d++) {
            downEls[d].hidden = simRunning !== false;
        }
        var startEls = document.querySelectorAll("[data-jaia-sim-start]");
        for (var s = 0; s < startEls.length; s++) {
            startEls[s].hidden = !canStart;
        }
        var askEls = document.querySelectorAll("[data-jaia-sim-ask]");
        for (var a = 0; a < askEls.length; a++) {
            askEls[a].hidden = canStart;
        }
    }

    // Registering a first device leaves the user on the portal's settings
    // page, still short of the second factor the sites need.
    var banner = null;
    function applyFinishBanner() {
        var show = !identity.signedIn && !!partialUser && path.indexOf("/settings") === 0;
        if (show && !banner) {
            banner = el("div", "jaia-finish");
            banner.appendChild(
                el(
                    "span",
                    "jaia-finish-text",
                    "Once you've added your security key or authenticator app, use it to finish signing in."
                )
            );
            var go = el("a", "jaia-finish-button", "Finish signing in");
            go.href = LOGIN_URL;
            banner.appendChild(go);
            root.appendChild(banner);
        } else if (!show && banner) {
            root.removeChild(banner);
            banner = null;
        }
    }

    function loadPartial() {
        return fetch("/api/state", { cache: "no-store" })
            .then(function (response) {
                return response.ok ? response.json() : null;
            })
            .then(function (state) {
                var data = (state && state.data) || {};
                partialUser = data.authentication_level === 1 ? data.username || "" : "";
            })
            .catch(function () {});
    }

    function loadSim() {
        fetch("/_jaia/sim", { cache: "no-store" })
            .then(function (response) {
                var running = response.ok ? true : response.status >= 502 ? false : null;
                if (running === null || running === simRunning) return;
                // The "not running" page stands in for the sim site until it is up
                if (running && document.querySelector("[data-jaia-sim-wait]")) {
                    location.reload();
                    return;
                }
                simRunning = running;
                applyToPage();
            })
            .catch(function () {});
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
            .then(function () {
                if (site === "auth" && !identity.signedIn) return loadPartial();
                partialUser = "";
            })
            .then(applyToPage);
    }

    function loadFleet() {
        fetch("/_jaia/fleet", { cache: "no-cache" })
            .then(function (response) {
                return response.ok ? response.text() : "";
            })
            .then(function (text) {
                var fleet = text.trim();
                if (/^\d+$/.test(fleet)) toggleFleet.textContent = "Fleet " + fleet;
            })
            .catch(function () {});
    }

    function start() {
        document.body.appendChild(root);
        // Apps that mount on <body> (LLDAP) clear it after this runs
        new MutationObserver(function () {
            if (!root.isConnected && document.body) document.body.appendChild(root);
        }).observe(document.documentElement, { childList: true, subtree: true });
        applyToPage();
        loadFleet();
        loadIdentity();
        loadSim();
        if (document.querySelector("[data-jaia-sim], [data-jaia-sim-wait]")) {
            setInterval(function () {
                if (!document.hidden) loadSim();
            }, SIM_POLL_MS);
        }
        // The portal signs in and out without reloading the page
        if (site === "auth" && window.PerformanceObserver) {
            new PerformanceObserver(function (list) {
                var changed = list.getEntries().some(function (entry) {
                    return /\/api\/(firstfactor|secondfactor|logout)/.test(entry.name);
                });
                if (changed) loadIdentity();
            }).observe({ type: "resource" });
        }
    }

    if (document.body) {
        start();
    } else {
        document.addEventListener("DOMContentLoaded", start);
    }
})();
