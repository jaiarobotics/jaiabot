import React from "react";

const formatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" });

const MIN_WARP = 0.1;
const MAX_WARP = 1000;

function durationStringFromSeconds(duration_seconds: number): string {
    var components = [];

    if (duration_seconds >= 3600) {
        let hours = Math.floor(duration_seconds / 3600);
        components.push(`${hours} hr`);
        duration_seconds -= hours * 3600;
    }

    if (duration_seconds >= 60) {
        let minutes = Math.floor(duration_seconds / 60);
        components.push(`${minutes} min`);
        duration_seconds -= minutes * 60;
    }

    if (duration_seconds >= 0) {
        components.push(`${duration_seconds.toFixed(0)} sec`);
    }

    return components.join(", ");
}

function clampWarp(warp: number): number {
    return Math.min(MAX_WARP, Math.max(MIN_WARP, warp));
}

interface TimeSliderProps {
    tMin: number;
    tMax: number;
    t: number;
    onValueChanged: (t: number) => void;
    playbackDirection: -1 | 0 | 1;
    warp: number;
    onWarpChanged: (warp: number) => void;
    onStep: (direction: -1 | 1) => void;
    onPlay: (direction: -1 | 1) => void;
    onPause: () => void;
    onReset: () => void;
}

export default function TimeSlider(props: TimeSliderProps) {
    if (props.tMin == null || props.tMax == null) {
        return <div></div>;
    }

    function mouseEvent(evt: React.MouseEvent) {
        if (!(evt.buttons & 1)) {
            return;
        }

        const timeSlider = document.getElementById("TimeSlider");
        const nativeEvent = evt.nativeEvent;

        if (timeSlider == null) {
            return;
        }

        const fraction = nativeEvent.offsetX / timeSlider.offsetWidth;
        const t = props.tMin + fraction * (props.tMax - props.tMin);

        props.onValueChanged?.(t);
    }

    function warpChanged(evt: React.ChangeEvent<HTMLInputElement>) {
        const parsedWarp = Number(evt.target.value);
        if (!Number.isFinite(parsedWarp)) {
            return;
        }

        props.onWarpChanged(clampWarp(parsedWarp));
    }

    const t = props.t ?? props.tMin;
    const fraction = (t - props.tMin) / (props.tMax - props.tMin);

    const dateString = formatter.format(new Date(t / 1e3));
    const elapsedTimeString = durationStringFromSeconds((t - props.tMin) / 1e6);

    var slider = (
        <div
            id="TimeSlider"
            className="TimeSlider flexbox vertical"
            onMouseDown={mouseEvent}
            onMouseMove={mouseEvent}
        >
            <div className="TimeSliderBack">{TimeSliderPast(fraction ?? 0)}</div>
            <div className="TimeSliderStatus">{`${dateString}  (${elapsedTimeString})`}</div>
            <div
                className="PlaybackControls"
                onMouseDown={(evt: React.MouseEvent<HTMLDivElement>) => evt.stopPropagation()}
            >
                <button
                    className="PlaybackButton"
                    title="Reset to start"
                    type="button"
                    onClick={props.onReset}
                >
                    Start
                </button>
                <button
                    className="PlaybackButton"
                    title="Step backward by the current warp value in seconds"
                    type="button"
                    onClick={() => props.onStep(-1)}
                >
                    -Step
                </button>
                <button
                    className={
                        props.playbackDirection === -1
                            ? "PlaybackButton selectedPlaybackButton"
                            : "PlaybackButton"
                    }
                    title="Play backward at the current warp speed"
                    type="button"
                    onClick={() => props.onPlay(-1)}
                >
                    ◀ Play
                </button>
                <button
                    className="PlaybackButton"
                    title="Pause playback"
                    type="button"
                    onClick={props.onPause}
                >
                    Pause
                </button>
                <button
                    className={
                        props.playbackDirection === 1
                            ? "PlaybackButton selectedPlaybackButton"
                            : "PlaybackButton"
                    }
                    title="Play forward at the current warp speed"
                    type="button"
                    onClick={() => props.onPlay(1)}
                >
                    Play ▶
                </button>
                <button
                    className="PlaybackButton"
                    title="Step forward by the current warp value in seconds"
                    type="button"
                    onClick={() => props.onStep(1)}
                >
                    Step+
                </button>
                <label className="WarpInputLabel">
                    Warp
                    <input
                        className="WarpInput"
                        type="number"
                        min={MIN_WARP}
                        max={MAX_WARP}
                        step="0.1"
                        value={props.warp}
                        onChange={warpChanged}
                    />
                </label>
            </div>
        </div>
    );

    return slider;
}

function TimeSliderPast(fraction: number) {
    const widthPercent = Math.min(100, Math.max(0, fraction * 100));
    return <div className="TimeSliderPast" style={{ width: `${widthPercent}%` }}></div>;
}
