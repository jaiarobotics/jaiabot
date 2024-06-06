/**
 * Creates an array of colors, such that they have good hue and brightness contrast, and pleasant saturation.
 *
 * @returns An array of CSS strings representing the colors.
 */
function getBotPathColors() {
    var array: string[] = [];
    var start: number;
    var step: number;
    const cycleCount = 4;

    const hues = [0, 120, 240, 60, 180, 300];
    const brightnesses = [50, 25, 75];

    for (let brightness of brightnesses) {
        for (let hue of hues) {
            const color = `hsl(${hue}, 50%, ${brightness}%)`;
            array.push(color);
        }
    }

    return array;
}

const botPathColors = getBotPathColors();

/**
 * Get the CSS color string for a bot_id's bot path.
 *
 * @param {number} bot_id Id of the bot.
 * @returns The CSS color string.
 */
export function getBotPathColor(bot_id: number) {
    return botPathColors[(bot_id - 1) % botPathColors.length];
}
