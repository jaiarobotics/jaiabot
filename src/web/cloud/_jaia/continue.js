// The Continue page: the same address again with confirmed=1 added, which Caddy
// then passes through to Authelia. A button rather than a link, so that a scanner
// following links in the page does not spend the token either.

function confirmedUrl(href) {
    var url = new URL(href);
    url.searchParams.set("confirmed", "1");
    return url.toString();
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
        var site = document.querySelector("[data-jaia-site]");
        if (site) {
            site.textContent = location.hostname.replace(/^auth\./, "");
        }
        var button = document.querySelector("[data-jaia-continue]");
        if (button) {
            button.addEventListener("click", function () {
                location.assign(confirmedUrl(location.href));
            });
        }
    });
}

if (typeof module !== "undefined") {
    module.exports = { confirmedUrl: confirmedUrl };
}
