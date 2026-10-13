import { Feature } from "ol";
import { Point } from "ol/geom";
import { Icon } from "ol/style";
import { BotStatus } from "@proto/jaiabot/messages/jaia_dccl";
import { botMarker } from "../Styles";

function botFeature(bot: BotStatus, properties: Record<string, unknown> = {}) {
    const feature = new Feature({ geometry: new Point([0, 0]) });
    feature.set("bot", bot);
    feature.setProperties(properties);
    return feature;
}

describe("botMarker", () => {
    test("labels the marker with the bot id and rotates it to the heading", () => {
        const [body] = botMarker(botFeature({ bot_id: 2, attitude: { heading: 90 } }));

        expect(body.getText().getText()).toBe("2");
        expect((body.getImage() as Icon).getRotation()).toBeCloseTo(Math.PI / 2, 10);
    });

    test("draws a marker for a feature with no bot status", () => {
        const [body] = botMarker(new Feature({ geometry: new Point([0, 0]) }));

        expect(body.getText().getText()).toBe("");
        expect((body.getImage() as Icon).getRotation()).toBe(0);
    });

    test("colours a disconnected bot differently", () => {
        const bot = { bot_id: 2 };
        const [connected] = botMarker(botFeature(bot));
        const [disconnected] = botMarker(botFeature(bot, { isDisconnected: true }));

        expect((disconnected.getImage() as Icon).getColor()).not.toEqual(
            (connected.getImage() as Icon).getColor(),
        );
    });
});
