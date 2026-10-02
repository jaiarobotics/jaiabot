#!/usr/bin/env python3

"""The customer's side of a support grant.

Jaia asks for access by signing a request with one of its root keys; this serves
the page where the customer reads that request and decides. Neither side can act
alone: a request that ssh-keygen cannot verify against the root keys on this
image is drawn with no approve button, and a verified one still does nothing
until someone who can log in here presses it.

Deciding is all this does. Every grant, and everything a grant carries, is held
and applied by jaia-support-access.py, which the timer runs too - so what the
page shows is what the fleet actually has, not a second account of it.
"""

import html
import http.cookies
import http.server
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.parse

MAX_DAYS = 14
NAMESPACE = "jaia-support"
PRINCIPAL = "jaia-support"

BEGIN_MARKER = "-----BEGIN JAIA SUPPORT REQUEST-----"
END_MARKER = "-----END JAIA SUPPORT REQUEST-----"

CSRF_COOKIE = "jaia_support_csrf"
AUDIT_SHOWN = 25

ALLOWED_SIGNERS = os.environ.get("JAIA_SUPPORT_ALLOWED_SIGNERS",
                                 "/etc/jaiabot/support/allowed_signers")
STATE_DIR = os.environ.get("JAIA_SUPPORT_STATE_DIR", "/var/log/jaiabot/auth/support")
ACCESS = os.environ.get("JAIA_SUPPORT_ACCESS", "/usr/bin/jaia-support-access.py")
LISTEN_PORT = int(os.environ.get("JAIA_SUPPORT_PORTAL_PORT", "9992"))

AUDIT_FILE = os.path.join(STATE_DIR, "audit.log")


class Refused(Exception):
    """A request the customer should see the reason for, rather than a traceback."""


def stamp(when):
    return time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(when))


####################
## Signed request ##
####################

def split_request(pasted):
    text = pasted.replace("\r\n", "\n")
    if BEGIN_MARKER not in text or END_MARKER not in text:
        raise Refused("That is not a Jaia support request: its BEGIN and END lines are missing.")

    body = text.split(BEGIN_MARKER, 1)[1].split(END_MARKER, 1)[0]
    lines = [line for line in body.split("\n") if line.strip()]
    if len(lines) < 2:
        raise Refused("The request is incomplete: it carries no signature.")

    # The payload is signed as one line with no trailing newline, so it has to be
    # handed back to ssh-keygen exactly as it was pasted
    return lines[0], "\n".join(lines[1:]) + "\n"


def verify(payload, signature):
    with tempfile.TemporaryDirectory() as directory:
        sigfile = os.path.join(directory, "request.sig")
        with open(sigfile, "w") as f:
            f.write(signature)

        verified = subprocess.run(
            ["ssh-keygen", "-Y", "verify", "-f", ALLOWED_SIGNERS,
             "-I", PRINCIPAL, "-n", NAMESPACE, "-s", sigfile],
            input=payload.encode(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    if verified.returncode != 0:
        raise Refused("No Jaia root key signed this request, or it has been changed since "
                      "it was signed.")

    found = re.search(r"SHA256:[A-Za-z0-9+/=]+", verified.stdout.decode("utf-8", "replace"))
    return found.group(0) if found else "unknown key"


def check(payload, fleet, now):
    try:
        request = json.loads(payload)
        asked = {"fleet": int(request["fleet"]),
                 "days": int(request["days"]),
                 "requested_at": int(request["requested_at"]),
                 "expires_at": int(request["expires_at"]),
                 "reason": str(request["reason"])}
    except (TypeError, ValueError, KeyError):
        raise Refused("The signature is good but the request itself is malformed.")

    if asked["fleet"] != fleet:
        raise Refused("This request asks for fleet {}, and this CloudHub serves fleet {}."
                      .format(asked["fleet"], fleet))
    if not 1 <= asked["days"] <= MAX_DAYS:
        raise Refused("This request asks for {} days of access; {} is the most that can be "
                      "granted.".format(asked["days"], MAX_DAYS))
    # Jaia's own window, not the grant's: a request left unapproved long enough
    # to lapse is one whose reason has had time to go stale
    if asked["expires_at"] <= now:
        raise Refused("This request lapsed on {}; ask Jaia for a new one."
                      .format(stamp(asked["expires_at"])))

    return asked


############
## State  ##
############

def access(*args):
    done = subprocess.run([ACCESS] + list(args), stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, text=True)
    if done.returncode != 0:
        raise RuntimeError(done.stderr.strip() or "jaia-support-access.py failed")
    return done.stdout.strip()


def state():
    return json.loads(access("status"))


def recent_decisions():
    try:
        with open(AUDIT_FILE) as f:
            lines = f.readlines()[-AUDIT_SHOWN:]
    except OSError:
        return []
    entries = []
    for line in reversed(lines):
        try:
            entries.append(json.loads(line))
        except ValueError:
            continue
    return entries


##########
## Page ##
##########

STYLE = """
body { font-family: sans-serif; margin: 0 auto; max-width: 52rem; padding: 2rem 1rem;
       color: #202020; }
h1 { font-size: 1.4rem; }
h2 { font-size: 1.1rem; margin-top: 2rem; }
textarea { width: 100%; height: 12rem; font-family: monospace; font-size: 0.8rem; }
table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
th { text-align: left; padding: 0.3rem 1rem 0.3rem 0; vertical-align: top;
     font-weight: normal; color: #606060; }
td { padding: 0.3rem 1rem 0.3rem 0; vertical-align: top; }
table.log { font-size: 0.85rem; }
table.log td { border-top: 1px solid #e8e8e8; }
.banner { padding: 0.8rem 1rem; border-radius: 4px; margin: 1rem 0; }
.granted { background: #e8f4e8; border: 1px solid #93c293; }
.none { background: #f0f0f0; border: 1px solid #c8c8c8; }
.refused { background: #f8e8e8; border: 1px solid #c29393; }
.quiet { color: #707070; font-size: 0.85rem; }
button { font-size: 1rem; padding: 0.5rem 1.2rem; }
"""


def page(title, body):
    return ("<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            "<title>{}</title><style>{}</style></head><body>{}</body></html>"
            .format(html.escape(title), STYLE, body))


def rows(pairs, css=""):
    return "<table{}>{}</table>".format(" class=\"{}\"".format(css) if css else "", "".join(
        "<tr><th>{}</th><td>{}</td></tr>".format(html.escape(name), html.escape(str(value)))
        for name, value in pairs))


def banner(now, current):
    if current["trouble"]:
        return "<p class=\"banner refused\">The user directory could not be reached, so this " \
               "may be out of date: {}</p>".format(html.escape(current["trouble"]))

    grant = current["grant"]
    if not current["member"] and not grant:
        return "<p class=\"banner none\">Jaia has no access to this fleet.</p>"
    if not grant:
        return ("<p class=\"banner refused\">Jaia's support account is in the "
                "<code>jaia_support</code> group with no grant on record. The next "
                "reconciliation will take it back out.</p>")

    carried = "".join(
        "<tr><th>Reaches the fleet</th><td>support{} until {}</td></tr>".format(
            html.escape(str(held["desktop"])), html.escape(stamp(held["expires_at"])))
        for held in current["tier3"])

    return ("<p class=\"banner granted\">Jaia has access to this fleet until {}.</p>"
            "<table>{}{}</table>".format(
                html.escape(stamp(grant["expires_at"])),
                "".join("<tr><th>{}</th><td>{}</td></tr>".format(html.escape(name),
                                                                 html.escape(str(value)))
                        for name, value in [("Reason", grant.get("reason", "")),
                                            ("Approved", stamp(grant.get("approved_at", 0))),
                                            ("Approved by", grant.get("approved_by", "")),
                                            ("Signed with", grant.get("signer", ""))]),
                carried))


def log_table():
    entries = recent_decisions()
    if not entries:
        return ""
    return "<h2>What has been granted</h2><table class=\"log\">{}</table>".format("".join(
        "<tr><td>{}</td><td>{}</td><td>{}</td></tr>".format(
            html.escape(stamp(entry.get("at", 0))),
            html.escape(entry.get("action", "")),
            html.escape(entry.get("reason") or entry.get("why") or
                        ("support{}".format(entry["desktop"]) if "desktop" in entry else "")))
        for entry in entries))


def form(token, pasted="", problem=""):
    warning = ("<p class=\"banner refused\">{}</p>".format(html.escape(problem))
               if problem else "")
    return ("""{}<h2>Grant access</h2>
<p>Paste the request Jaia sent you. It is checked against Jaia's own keys before
anything is shown.</p>
<form method="post" action="/">
<input type="hidden" name="csrf" value="{}">
<textarea name="request" placeholder="{}" required>{}</textarea>
<p><button type="submit" name="action" value="review">Check this request</button></p>
</form>""".format(warning, html.escape(token), BEGIN_MARKER, html.escape(pasted)))


def status_page(token, now, current, pasted="", problem=""):
    ending = ""
    if current["grant"] or current["member"]:
        ending = ("""<form method="post" action="/">
<input type="hidden" name="csrf" value="{}">
<p><button type="submit" name="action" value="revoke">End Jaia's access now</button></p>
</form>""".format(html.escape(token)))

    last = current.get("last_reconcile")
    footer = "<p class=\"quiet\">Last checked {}.</p>".format(
        html.escape(stamp(last))) if last else \
        "<p class=\"quiet\">Access has not been checked since this CloudHub started.</p>"

    return page("Jaia support access",
                "<h1>Jaia support access</h1>{}{}{}{}{}".format(
                    banner(now, current), ending, form(token, pasted, problem),
                    log_table(), footer))


def review_page(token, asked, signer, pasted, now):
    would_end = now + min(asked["days"], MAX_DAYS) * 86400
    return page("Approve Jaia support access", """<h1>Approve Jaia support access</h1>
<p class="banner granted">This request is signed by a Jaia root key.</p>
{}
<p>Approving lets Jaia log in to this CloudHub, and reach the fleet from it, until
{}. You can end it here at any time before that.</p>
<form method="post" action="/">
<input type="hidden" name="csrf" value="{}">
<input type="hidden" name="request" value="{}">
<button type="submit" name="action" value="approve">Approve</button>
</form>
<p><a href="/">Cancel</a></p>""".format(
        rows([("Reason", asked["reason"]),
              ("Fleet", asked["fleet"]),
              ("Access for", "{} days".format(asked["days"])),
              ("Requested", stamp(asked["requested_at"])),
              ("Would end", stamp(would_end)),
              ("Signed with", signer)]),
        html.escape(stamp(would_end)), html.escape(token), html.escape(pasted)))


def done_page(message):
    return page("Jaia support access",
                "<h1>Jaia support access</h1><p class=\"banner granted\">{}</p>"
                "<p><a href=\"/\">Back</a></p>".format(html.escape(message)))


#############
## Serving ##
#############

class Portal(http.server.BaseHTTPRequestHandler):
    server_version = "jaia-support-portal"
    protocol_version = "HTTP/1.1"

    fleet = 0

    def log_message(self, fmt, *args):
        sys.stderr.write("{} {}\n".format(self.address_string(), fmt % args))

    def reply(self, body, status=200, cookie=None):
        raw = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
        if cookie:
            self.send_header("Set-Cookie", "{}={}; Path=/; HttpOnly; Secure; SameSite=Strict"
                             .format(CSRF_COOKIE, cookie))
        self.end_headers()
        self.wfile.write(raw)

    def cookie_token(self):
        jar = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        if CSRF_COOKIE in jar and re.fullmatch(r"[0-9a-f]{32}", jar[CSRF_COOKIE].value):
            return jar[CSRF_COOKIE].value
        return None

    def who(self):
        # Set by Caddy from Authelia's answer; this listens on loopback so that
        # nothing but Caddy is in a position to assert it
        return self.headers.get("Remote-User", "")

    def current(self):
        try:
            return state()
        except Exception as problem:
            self.log_message("could not read the grant: %s", problem)
            return {"grant": None, "member": False, "tier3": [], "last_reconcile": None,
                    "trouble": str(problem)}

    def do_GET(self):
        if urllib.parse.urlparse(self.path).path != "/":
            self.send_error(404)
            return

        token = self.cookie_token()
        fresh = token is None
        token = token or secrets.token_hex(16)
        self.reply(status_page(token, int(time.time()), self.current()),
                   cookie=token if fresh else None)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length > 256 * 1024:
            self.send_error(413)
            return
        fields = urllib.parse.parse_qs(self.rfile.read(length).decode("utf-8", "replace"))

        def field(name):
            return fields.get(name, [""])[0]

        token = self.cookie_token()
        if not token or not secrets.compare_digest(token, field("csrf")):
            self.send_error(403, "Stale form; go back to the start and try again")
            return

        if not self.who():
            self.send_error(403, "Not authenticated")
            return

        now = int(time.time())
        action = field("action")
        pasted = field("request")

        if action == "revoke":
            self.act(lambda: access("revoke", "--by", self.who()),
                     "Jaia's access has ended.", token, pasted)
            return

        try:
            payload, signature = split_request(pasted)
            signer = verify(payload, signature)
            asked = check(payload, self.fleet, now)
        except Refused as refusal:
            self.reply(status_page(token, now, self.current(), pasted, str(refusal)))
            return

        if action == "approve":
            ends = now + min(asked["days"], MAX_DAYS) * 86400
            self.act(lambda: access("approve", "--fleet", str(asked["fleet"]),
                                    "--days", str(asked["days"]), "--reason", asked["reason"],
                                    "--by", self.who(), "--signer", signer),
                     "Jaia has access to this fleet until {}.".format(stamp(ends)),
                     token, pasted)
        else:
            self.reply(review_page(token, asked, signer, pasted, now))

    def act(self, action, message, token, pasted):
        try:
            action()
        except Exception as problem:
            self.log_message("action failed: %s", problem)
            self.reply(status_page(token, int(time.time()), self.current(), pasted,
                                   "That did not work: {}".format(problem)), status=500)
            return
        self.reply(done_page(message))


def main():
    if "JAIA_FLEET_ID" not in os.environ:
        sys.exit("JAIA_FLEET_ID is not set, so a request cannot be checked against this fleet")
    Portal.fleet = int(os.environ["JAIA_FLEET_ID"])

    if not os.path.exists(ALLOWED_SIGNERS) or not os.path.getsize(ALLOWED_SIGNERS):
        sys.exit("{} is missing or empty, so nothing could verify a request"
                 .format(ALLOWED_SIGNERS))

    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)

    server = http.server.ThreadingHTTPServer(("127.0.0.1", LISTEN_PORT), Portal)
    server.serve_forever()


if __name__ == "__main__":
    main()
