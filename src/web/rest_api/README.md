# JaiaBot REST API

A simple Flask-based REST API that lets you interact with JaiaBot bots and hubs over HTTP. Get status, send commands, and retrieve data - all via JSON.

## Quick Start

**Just want to get it running?** Here you go:

```bash
cd src/web/rest_api
./run.sh
```

That's it! The API is now running on `http://localhost:9092`. Try it:

```bash
# Get status of all bots and hubs
curl -X POST http://localhost:9092/jaia/v1 \
  -H "Content-Type: application/json" \
  -d '{"target": {"all": true}, "status": true}'
```

> **Note:** For development, authentication is disabled by default when using `run.sh`

## What Can It Do?

- 📊 **Query status** - Get real-time bot and hub status
- 📝 **Retrieve metadata** - Fetch hub metadata (versions, configuration, etc.)
- 📦 **Get task packets** - Pull historical task data for analysis
- 🎮 **Send commands** - Control bots (start, stop, etc.) and hubs
- 🔐 **API key auth** - Secure your API with optional authentication

## Directory Layout

Here's what's in this directory:

```
rest_api/
├── app.py                    # 🚀 Main Flask app - routes and request handling
├── run.sh                    # 🎬 Start script - use this for development!
├── gen_api_key.py           # 🔑 Generate API keys
│
├── v1/                       # Version 1 API implementation
│   └── api.py               # 💡 THIS is where you add new endpoints!
│
├── common/                   # Shared utilities (you probably won't touch these)
│   ├── api_exception.py     # Error handling
│   ├── shared_data.py       # Thread-safe data storage
│   ├── streaming_client.py  # Talks to the web portal
│   ├── lattice.py           # Publishes status and task packets to Lattice
│   ├── target.py            # Parses "b1,b2" or "all" targets
│   └── ...
│
└── test/                     # Tests
    ├── test.sh              # 🧪 Run all tests
    ├── short_api_test.py    # Tests JSON POST format
    └── long_api_test.py     # Tests URL-based format
```

**For most development, you'll only touch:**

- `v1/api.py` - Add your endpoint handlers here
- `src/lib/messages/rest_api.proto` - Define your messages here
- `test/*.py` - Add tests here

## Starting the REST API

### Development (Easy Mode)

```bash
./run.sh
```

Done! Server is running on port 9092.

### Development (Custom Options)

Need to connect to a different hub or change settings?

```bash
# Connect to a specific hub
./app.py -e "1:192.168.1.100:40000"

# Multiple hubs? No problem
./app.py -e "1:192.168.1.100:40000,2:192.168.1.101:40000"

# Different port
./app.py -b 8080

# Debug logging (helpful when things go wrong)
./app.py -l DEBUG

# All together now
./app.py -e "1:192.168.1.100:40000" -b 8080 -l DEBUG
```

**Command line options:**

- `-e` : Streaming endpoint(s) - format: `HubID:Hostname:Port` (comma-separated for multiple)
- `-b` : Port to bind Flask server (default: 9092)
- `-l` : Log level - DEBUG, INFO, WARNING, ERROR (default: WARNING)
- `-c` : Config file path (default: `/etc/jaiabot/rest_api.pb.cfg`)

### Configuration File (Optional)

You can use a config file instead of command-line arguments. Create `/etc/jaiabot/rest_api.pb.cfg`:

```protobuf
flask_bind_port: 9092

streaming_endpoint {
    hub_id: 1
    hostname: "localhost"
    port: 40000
}

# For production - require API keys
no_key_required: false

key {
    private_key: "your-secret-key-here"
    permission: [ALL]
}
```

### API Keys

**Development (no auth):**

```bash
export JAIA_REST_API_PRIVATE_KEY=""
./run.sh
```

**Production (secure):**

```bash
# Generate a random key
./gen_api_key.py

# This outputs something like:
# key {
#     private_key: "abc123xyz..."
#     permission: [ALL]
# }

# Add it to /etc/jaiabot/rest_api.pb.cfg
```

Then use the key in your requests:

```bash
curl -X POST http://localhost:9092/jaia/v1 \
  -H "Content-Type: application/json" \
  -d '{"target": {"all": true}, "status": true, "api_key": "abc123xyz..."}'
```

## Publishing to Lattice

The API can forward the bot status, hub status and task packets it receives on to the [Anduril Lattice](https://developer.anduril.com/) Entities API, so the fleet shows up on a Lattice map.

> **This is outbound only.** Entities are pushed to Lattice once per second. Nothing Lattice sends back is read, so there is no path for Lattice to command a bot or send it anything.

**What gets published:**

| Jaia data   | Lattice entity                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Bot status  | `TEMPLATE_ASSET` at the bot's position, with its depth, speed, heading, health, mission state and battery     |
| Hub status  | `TEMPLATE_ASSET` at the hub's position, with its health                                                       |
| Task packet | `TEMPLATE_SENSOR_POINT_OF_INTEREST` where the dive or drift started, with the depth, temperature and salinity |

Each bot, hub and task packet keeps the same Lattice entity ID across restarts, so nothing gets duplicated on the map.

Task packets already in the database when publishing starts are treated as history
and are not published; anything that arrives afterwards is. Which packets are new is
tracked by what has been published rather than by their timestamps, because
`TaskPacket.start_time` is the bot's own idea of the time and can sit hours away from
the wall clock.

### Settings

Publishing is off until it is configured, either way round below.

> **The endpoint is the environment host**, the single label in front of
> `.env.sandboxes.developer.anduril.com` - for example
> `lattice-abc123.env.sandboxes.developer.anduril.com`. A sandbox also publishes a
> host per service running in it, which carries an extra label on the front
> (`someservice.lattice-abc123.env.sandboxes.developer.anduril.com`). Those serve
> that one service, not the Entities API, so drop any leading service label.

**All the options:**

| Field                        | Default   | What it does                                                      |
| ---------------------------- | --------- | ----------------------------------------------------------------- |
| `endpoint`                   | required  | Lattice environment hostname, with no service label and no scheme |
| `environment_token`          | required  | Bearer token for that environment                                 |
| `sandbox_token`              | -         | Sandboxes account token, for sandbox environments only            |
| `integration_name`           | `JaiaBot` | Name Lattice attributes these entities to                         |
| `publish_period_seconds`     | 1         | Seconds between publishes                                         |
| `status_timeout_seconds`     | 30        | Stop publishing a bot or hub this long after its last status      |
| `status_expiry_seconds`      | 300       | How long Lattice keeps a bot or hub after its last publish        |
| `task_packet_expiry_seconds` | 86400     | How long Lattice keeps a task packet                              |
| `request_timeout_seconds`    | 5         | How long to wait on each request to Lattice                       |

Run two fleets into the same Lattice environment? Give each one its own `integration_name`, or bot 1 of each fleet will fight over the same entity.

`status_expiry_seconds` does two jobs. Each publish tells Lattice to keep the bot
or hub for that long, and every publish pushes the deadline out again, so a bot
disappears from Lattice this long after the last time we published it. Lattice
checks that deadline against its own clock, so the same number is how far behind
Lattice this machine's clock may drift before it rejects every publish as
already expired. Keep it comfortably larger than any clock error you expect.

### Run it in the simulator

In the first terminal, start the simulator:

```bash
cd config/launch/simulation
./generate_all_launch.sh 4 5
./all.launch
```

In the second, start the REST API with your Lattice details:

```bash
cd src/web/rest_api
export JAIA_REST_API_PRIVATE_KEY="" # leave blank - the empty string is what turns authentication off for development
export JAIA_LATTICE_ENDPOINT="lattice-abc123.env.sandboxes.developer.anduril.com"
export JAIA_LATTICE_ENVIRONMENT_TOKEN="..."
export JAIA_LATTICE_SANDBOX_TOKEN="..." # remove if you are not using a sandbox
./run.sh
```

The bots appear in Lattice about twenty seconds later.

Take the endpoint and the environment token from your [sandbox
environment](https://developer.anduril.com/guides/developer-tools/sandboxes) page,
and the Sandboxes token from Account & Security. Use `run.sh` from `rest_api`:
`src/web/server` has one too, it serves the JCC instead, and it ignores these
variables.

Publish the simulator to a sandbox rather than to a stack anyone else is watching.
The bots are real entities on the map to everyone else looking at it.

Finally, start the JCC in a third terminal:

```bash
cd src/web
./run.sh
```

It serves the JCC at `http://localhost:40001/`.

### Run it on a hub

The REST API starts with Apache at boot, so it only needs the configuration on
disk:

```bash
sudo tee -a /etc/jaiabot/rest_api.pb.cfg > /dev/null <<'EOF'
lattice {
    endpoint: "your-lattice-host"
    environment_token: "your-lattice-environment-token"
}
EOF
sudo chmod 600 /etc/jaiabot/rest_api.pb.cfg
sudo systemctl reload apache2
```

The hub publishes from then on, including after a reboot. Environment variables
are no help here because Apache starts the API, not your shell.

> **Careful:** the tokens end up in the API's own log, because it logs its whole
> configuration on startup (as it already does for API keys). Don't publish those
> logs.

## Running Tests

**Make sure the API server is running first!**

```bash
# Terminal 1: Start the server
./run.sh

# Terminal 2: Run tests
cd test
./test.sh
```

**Run individual tests:**

```bash
# Just the JSON POST tests
./test/short_api_test.py

# Just the URL-based tests
./test/long_api_test.py

# Test against a remote server
./test/short_api_test.py --api_host=192.168.1.100 --api_port=9092

# With HTTPS (useful for production testing)
./test/short_api_test.py --https --https-skip-verify

# The Lattice entity tests, which don't need a server or a Lattice environment
python3 -m pytest test/test_lattice.py
```

**What the tests do:**

- Send various requests to the API
- Check that responses match expected format
- Test error cases (missing fields, invalid data, etc.)
- Verify all endpoints work correctly

## Adding a New Endpoint

**Let's walk through adding a new endpoint step-by-step.**

Imagine we want to add a `reboot_bot` endpoint that reboots a specific bot.

### Step 1: Define the Message in `rest_api.proto`

Edit `src/lib/messages/rest_api.proto`. This is where **all** API messages are defined.

**A) Define what your request looks like:**

```protobuf
message RebootBotRequest {
    optional bool force = 1 [
        default = false,
        (jaia.field).rest_api = {
            presence: GUARANTEED,
            doc: "Force immediate reboot without graceful shutdown"
        }
    ];
}
```

**B) Define what your response looks like:**

```protobuf
message RebootBotResult {
    required bool success = 1 [(jaia.field).rest_api.presence = GUARANTEED];
    optional string message = 2 [(jaia.field).rest_api.presence = GUARANTEED];
}
```

**C) Add the request type to `APIRequest`:**

```protobuf
message APIRequest {
    // ... existing fields ...

    oneof action {
        // ... existing actions like status, metadata, etc. ...

        // YOUR NEW ACTION - pick an unused field number (e.g., 16)
        RebootBotRequest reboot_bot = 16 [(jaia.field).rest_api = {
            presence: GUARANTEED,
            doc: "Reboot a specific bot."
            example {
                request: '{"target": {"bots": [1]}, "reboot_bot": {"force": true}, "api_key": "..."}'
                response: '{"reboot_bot_result": {"success": true, "message": "Reboot command sent"}}'
            }
        }];
    }
}
```

**D) Add the response type to `APIResponse`:**

```protobuf
message APIResponse {
    // ... existing fields ...

    oneof action {
        // ... existing responses like status, metadata, etc. ...

        // YOUR NEW RESPONSE - use the same field number as the request (16)
        RebootBotResult reboot_bot_result = 16 [(jaia.field).rest_api = {
            presence: GUARANTEED,
            doc: "Result of reboot_bot action."
        }];
    }
}
```

**💡 Pro Tips:**

- Field numbers must be unique within each message
- Use `presence: GUARANTEED` so the field always shows up in JSON (even if empty)
- The `doc` field is used for auto-generated documentation
- Define your request/response messages (A & B) before adding them to APIRequest/APIResponse (C & D)
- Look at existing actions (like `command` or `status`) as examples

### Step 2: Rebuild the Proto Files

The `.proto` file needs to be compiled to Python code:

```bash
cd /path/to/jaiabot
./build.sh
```

This regenerates `rest_api_pb2.py` with your new messages. You'll import these in your Python code.

### Step 3: Implement the Handler

Now the fun part! Add your handler function to `v1/api.py`:

```python
def reboot_bot(jaia_request):
    """Handle reboot_bot requests."""
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

    # Get the parameters from the request
    force_reboot = jaia_request.reboot_bot.force

    # Figure out which bots to reboot
    bots_to_reboot = []
    hubs_to_use = []

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            # Reboot all known bots
            bots_to_reboot = list(common.shared_data.data.bots.keys())
        else:
            # Only reboot the requested bots (if we know about them)
            bots_to_reboot = [
                bot_id for bot_id in jaia_request.target.bots
                if bot_id in common.shared_data.data.bots.keys()
            ]

        # Figure out which hubs to send through
        if not jaia_request.target.hubs:
            hubs_to_use = list(common.shared_data.data.hubs.keys())
        else:
            hubs_to_use = [
                hub_id for hub_id in jaia_request.target.hubs
                if hub_id in common.shared_data.data.hubs.keys()
            ]

    # Send reboot command to each bot via each hub
    for hub_id in hubs_to_use:
        for bot_id in bots_to_reboot:
            # Create the message to send to the portal
            # (You'd need to define this in portal.proto too)
            client_msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
            # ... populate your reboot command here ...

            # Send it!
            send_client_to_portal_message(hub_id, client_msg)

    # Build the response
    if bots_to_reboot:
        jaia_response.reboot_bot_result.success = True
        jaia_response.reboot_bot_result.message = f"Reboot sent to {len(bots_to_reboot)} bot(s)"
        jaia_response.target.bots.extend(bots_to_reboot)
        jaia_response.target.hubs.extend(hubs_to_use)
    else:
        jaia_response.reboot_bot_result.success = False
        jaia_response.reboot_bot_result.message = "No bots found to reboot"

    return jaia_response
```

**🔑 Key Points:**

1. **Function name = action name**: The function `reboot_bot` matches the proto field name `reboot_bot`
2. **Auto-discovery**: You don't register it anywhere - `app.py` finds it automatically via `globals()`
3. **Thread safety**: Always use `with common.shared_data.data_lock:` when reading/writing shared data
4. **Return a response**: Always return an `APIResponse` with your result field populated
5. **Handle targets**: Check if `target.all` is set, or process specific `target.bots`/`target.hubs`

**Common Patterns:**

```python
# Read-only endpoint (like status)
with common.shared_data.data_lock:
    data = common.shared_data.data.bots[bot_id]
    # ... use the data ...

# Send command to portal
client_msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
client_msg.your_command.CopyFrom(your_command)
send_client_to_portal_message(hub_id, client_msg)

# Raise an error
raise APIException(
    jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_TARGET,
    "Bot 99 not found"
)
```

### Step 4: Add Tests

Add a test to `test/short_api_test.py`:

```python
# At the bottom of the file, add:

print("Testing reboot_bot...")
run_request(
    {"target": {"bots": [1]}, "reboot_bot": {"force": True}, "api_key": api_key},
    expected_response_subset={
        "request": {"reboot_bot": {"force": True}},
        "reboot_bot_result": {"success": True}
    }
)
```

And in `test/long_api_test.py`:

```python
# Test the URL-based format
run_request(
    "/jaia/v1/reboot_bot/b1",
    {"force": True},
    expected_response_subset={
        "reboot_bot_result": {"success": True}
    }
)
```

**Test both success and failure cases:**

```python
# Success case
run_request(
    {"target": {"bots": [1]}, "reboot_bot": {}, "api_key": api_key},
    expected_response_subset={"reboot_bot_result": {"success": True}}
)

# Error case - missing required field (if you have one)
run_request(
    {"target": {"all": True}, "reboot_bot": {}},  # missing something
    expected_response_subset={"error": {"code": "API_ERROR__REQUEST_NOT_INITIALIZED"}}
)
```

### Step 5: Test It!

```bash
# Terminal 1: Start server
./run.sh

# Terminal 2: Run your test
cd test
./test.sh
```

### Step 6: Try It Manually

```bash
# Using the short format (JSON POST)
curl -X POST http://localhost:9092/jaia/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "target": {"bots": [1]},
    "reboot_bot": {"force": true}
  }'

# Using the long format (URL-based)
curl -X POST http://localhost:9092/jaia/v1/reboot_bot/b1 \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# Or even simpler with GET (for simple actions)
curl "http://localhost:9092/jaia/v1/reboot_bot/b1?force=true"
```

### Optional: Add API Permissions

If you want to control who can use this action, update the permissions in `rest_api.proto`:

```protobuf
message APIConfig {
    message APIKey {
        enum Permission {
            ALL = 0 [(jaia.ev).rest_api = {
                permitted_action: [
                    'status', 'metadata', 'task_packets',
                    'command', 'command_for_hub',
                    'reboot_bot'  // ← Add your action here
                ]
            }];

            // Or create a specific permission
            REBOOT_BOT = 8 [(jaia.ev).rest_api = {
                permitted_action: ['reboot_bot']
            }];
        }
    }
}
```

---

### 📚 Learn by Example

The best way to learn? Look at existing endpoints in `v1/api.py`:

- **`status()`** - Simple read-only query, good starting point
- **`command()`** - Sending commands to bots, handles targets well
- **`task_packets()`** - Query with parameters, good for data retrieval
- **`metadata()`** - Shows error handling with `APIException`

## API Usage Examples

The API supports two formats: **short** (JSON POST) and **long** (URL-based).

### Short Format (JSON POST) - Recommended for Complex Requests

**Get status:**

```bash
curl -X POST http://localhost:9092/jaia/v1 \
  -H "Content-Type: application/json" \
  -d '{"target": {"all": true}, "status": true}'
```

**Send a command:**

```bash
curl -X POST http://localhost:9092/jaia/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "target": {"bots": [1, 2]},
    "command": {"type": "STOP"},
    "api_key": "your-key-if-needed"
  }'
```

**Query task packets:**

```bash
curl -X POST http://localhost:9092/jaia/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "target": {"bots": [1]},
    "task_packets": {
      "start_time": 1722797666581176,
      "end_time": 1722970466581176
    }
  }'
```

### Long Format (URL-based) - Quick & Easy for Simple Requests

**Pattern:** `/jaia/v1/<action>/<target>[?params]`

**Examples:**

```bash
# Get status of all bots/hubs
curl "http://localhost:9092/jaia/v1/status/all"

# Get status of specific bots
curl "http://localhost:9092/jaia/v1/status/b1,b2"

# Get status of specific hubs
curl "http://localhost:9092/jaia/v1/status/h1"

# Command with JSON body
curl -X POST http://localhost:9092/jaia/v1/command/b1,b2 \
  -H "Content-Type: application/json" \
  -d '{"type": "STOP"}'

# GET with query params (for simple types)
curl "http://localhost:9092/jaia/v1/status/all?api_key=abc123"
```

**Target Syntax:**

- `all` - All bots and hubs
- `b1,b2,b3` - Specific bots (use b prefix with bot IDs)
- `h1,h2` - Specific hubs (use h prefix with hub IDs)
- `b1,b2,h1` - Mix of bots and hubs

## How It Works (Under the Hood)

**Threading Model:**

```
┌─────────────────┐
│  Flask Server   │  ← Main thread: handles HTTP requests
│   (port 9092)   │
└────────┬────────┘
         │
         ├─→ Shared Data (thread-safe with lock)
         │   ├─ Bot status
         │   ├─ Hub status
         │   └─ Task packets
         │
         └─→ Streaming Thread(s) ← One per hub
             └─ Talks to web portal (async)
```

**Request Flow:**

```
1. HTTP Request → Flask (app.py)
2. Parse JSON → Protobuf (APIRequest)
3. Validate & check API key
4. Forward to handler (v1/api.py)
5. Handler does the work:
   - Read from shared_data, OR
   - Send command to portal via queue
6. Build response (APIResponse)
7. Convert to JSON → send back to client
```

**Error Codes:**

The API returns these error codes (defined in `rest_api.proto`):

| Code                                          | Meaning                         |
| --------------------------------------------- | ------------------------------- |
| `API_ERROR__UNSUPPORTED_API_VERSION`          | Wrong version (use v1)          |
| `API_ERROR__INVALID_ACTION`                   | Action doesn't exist            |
| `API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON` | Malformed JSON                  |
| `API_ERROR__REQUEST_NOT_INITIALIZED`          | Missing required fields         |
| `API_ERROR__INVALID_TARGET`                   | Invalid bot/hub ID              |
| `API_ERROR__NOT_IMPLEMENTED`                  | Action exists but not coded yet |

## Troubleshooting

### "Address already in use" / Port 9092 already taken

```bash
# Find what's using the port
sudo lsof -i :9092

# Kill it
kill <PID>

# Or use a different port
./app.py -b 8080
```

### Server starts but requests timeout

The streaming endpoint (web portal) probably isn't running or isn't reachable.

```bash
# Check if portal is up
nc -zv localhost 40000

# Try with verbose logging to see what's happening
./app.py -l DEBUG
```

### API key errors (403 Forbidden)

```bash
# For development, disable auth entirely
export JAIA_REST_API_PRIVATE_KEY=""
./run.sh

# Or check your config file
cat /etc/jaiabot/rest_api.pb.cfg
```

### Tests fail

```bash
# Make sure server is running first!
./run.sh

# In another terminal
cd test && ./test.sh

# If still failing, check you're using the right API key
echo $JAIA_REST_API_PRIVATE_KEY
```

### "ImportError: No module named jaiabot.messages"

The proto files haven't been built yet:

```bash
cd /path/to/jaiabot
./build.sh
```

### Getting empty responses `{}`

Check your handler function:

- Does the function name match the proto field name exactly?
- Are you populating the response object?
- Are you returning the response?

Enable debug logging to see what's happening:

```bash
./app.py -l DEBUG
```

## Tips & Tricks

**Quick debugging:**

```bash
# See all requests/responses in real-time
./app.py -l DEBUG

# Test without authentication
export JAIA_REST_API_PRIVATE_KEY=""

# Pretty-print JSON responses
curl ... | python3 -m json.tool
```

**Working with targets:**

```python
# In your handler function

# All bots
if jaia_request.target.all:
    bots = list(common.shared_data.data.bots.keys())

# Specific bots (only ones we know about)
else:
    bots = [
        bot_id for bot_id in jaia_request.target.bots
        if bot_id in common.shared_data.data.bots.keys()
    ]
```

**Useful references:**

- See how existing endpoints work: look at `status()`, `command()`, etc. in `v1/api.py`
- Proto message definitions: `src/lib/messages/rest_api.proto`
- Test examples: `test/short_api_test.py` and `test/long_api_test.py`

---

**Questions?** Check the existing implementations in `v1/api.py` - they're the best documentation!
