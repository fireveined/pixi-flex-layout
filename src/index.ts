import { applyContainerPolyfill } from "./containerPolyfill";
import { applyDisplayObjectPolyfill } from "./displayObjectPolyfill";

export function initializeYogaLayout() {
    applyDisplayObjectPolyfill();
    applyContainerPolyfill();
}
