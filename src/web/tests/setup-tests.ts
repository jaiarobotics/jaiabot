import "@testing-library/jest-dom";

// setupTests.ts
if (typeof PointerEvent === "undefined") {
    class MockPointerEvent extends MouseEvent {
        readonly pointerId: number;
        readonly width: number;
        readonly height: number;
        readonly pressure: number;
        readonly tiltX: number;
        readonly tiltY: number;
        readonly pointerType: string;
        readonly isPrimary: boolean;

        constructor(type: string, props: PointerEventInit = {}) {
            super(type, props);

            this.pointerId = props.pointerId ?? 0;
            this.width = props.width ?? 0;
            this.height = props.height ?? 0;
            this.pressure = props.pressure ?? 0;
            this.tiltX = props.tiltX ?? 0;
            this.tiltY = props.tiltY ?? 0;
            this.pointerType = props.pointerType ?? "mouse";
            this.isPrimary = props.isPrimary ?? true;
        }
    }

    (globalThis as any).PointerEvent = MockPointerEvent;
}
