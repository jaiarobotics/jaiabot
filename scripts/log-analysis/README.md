# Uploading logs to the log analysis server

The upload-logs.sh script will upload all .goby files in `/var/log/jaiabot` to a flat directory at `(SERVER):/var/log/jaiabot/bot_offload`, where SERVER is the server provided at the command-line.  The default server is `jaia@mercury`.

You can look at the logs by navigating to `(SERVER):40010` in your web browser.
