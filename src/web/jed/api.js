class JaiaAPI {
    constructor() {
        function randomBase57(stringLength) {
            const base57Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstvwxyz";

            var s = "";
            for (let i = 0; i < stringLength; i++) {
                s = s.concat(base57Chars[Math.floor(Math.random() * base57Chars.length)]);
            }
            return s;
        }

        this.inControl = true;
        this.clientId = randomBase57(22); // UUID-length
        this.apiThrottleEndTime = 0; // Time after which it's safe to send commands, (for throttling)
        this.headers = {
            clientId: this.clientId,
            "Content-Type": "application/json",
        };
    }

    /**
     * Send a request to the REST API
     *
     * @param {*} apiRequest APIRequest message
     * @returns {Promise<*>} APIResponse message
     */
    request(apiRequest) {
        return fetch("/jaia/v1", {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(apiRequest),
        })
            .then((response) => response.json())
            .then((response) => {
                if (response.error) {
                    throw new Error(response.error.details ?? response.error.code);
                }
                return response;
            });
    }

    /**
     * Send an engineering command
     *
     * @param {*} command
     */
    sendEngineeringCommand(command, force = false) {
        if (!this.inControl) {
            console.log(`Not inControl: ${this.clientId}`);
            return;
        }

        if (!force && Date.now() < this.apiThrottleEndTime) {
            return;
        }

        this.apiThrottleEndTime = Date.now() + 1000;

        return this.request({
            target: { bots: [Number(command.bot_id ?? command.botId)] },
            engineering_command: command,
        }).catch((e) => {
            alert(e.message);
        });
    }

    /**
     * Return status of the fleet, with each bot's engineering status and status age
     *
     * @returns {*}
     */
    getStatus() {
        return this.request({ target: { all: true }, pod_status: true })
            .then(({ pod_status }) => {
                const bots = {};
                for (const portalBotStatus of pod_status.bots ?? []) {
                    const bot = portalBotStatus.bot_status;
                    bots[bot.bot_id] = {
                        ...bot,
                        engineering: portalBotStatus.engineering,
                        portalStatusAge: portalBotStatus.portalStatusAge,
                    };
                }

                const controllingClientId = pod_status.controlling_client_id;
                this.inControl =
                    controllingClientId == this.clientId || controllingClientId == null;
                this.setControlBorder();
                return {
                    bots,
                    hubs: (pod_status.hubs ?? []).map(
                        (portalHubStatus) => portalHubStatus.hub_status,
                    ),
                    controllingClientId,
                };
            })
            .catch((e) => {
                alert(e);
            });
    }

    takeControl() {
        return this.request({ target: { all: true }, take_control: this.clientId });
    }

    setControlBorder() {
        let body = document.getElementById("body");
        if (this.inControl) {
            body.style.border = "none";
        } else {
            body.style.border = "3px solid red";
        }
    }
}

const api = new JaiaAPI();

export { JaiaAPI, api };
