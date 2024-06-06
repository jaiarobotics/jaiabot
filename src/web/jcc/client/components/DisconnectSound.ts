import { PodStatus } from "./shared/PortalStatus";
import SoundEffects from "./SoundEffects";

export function playDisconnectReconnectSounds(
    oldPodStatus: PodStatus | null,
    newPodStatus: PodStatus,
) {
    const bots = newPodStatus.bots;

    for (const botId in bots) {
        const bot = bots[botId];

        const oldBot = oldPodStatus?.bots?.[botId];
        if (oldBot == null) {
            continue;
        }

        // Sounds for disconnect / reconnect
        const disconnectThreshold = 30 * 1e6; // microseconds

        const oldPortalStatusAge = oldBot.portalStatusAge;

        bot.isDisconnected = bot.portalStatusAge >= disconnectThreshold;

        if (oldPortalStatusAge != null) {
            // Bot disconnect
            if (bot.isDisconnected) {
                if (oldPortalStatusAge < disconnectThreshold) {
                    SoundEffects.botDisconnect.play();
                }
            }

            // Bot reconnect
            if (bot.portalStatusAge < disconnectThreshold) {
                if (oldPortalStatusAge >= disconnectThreshold) {
                    SoundEffects.botReconnect.play();
                }
            }
        }
    }
}
