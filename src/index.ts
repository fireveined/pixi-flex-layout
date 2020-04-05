import * as PIXI from "pixi.js";
import { applyContainerPolyfill } from "./containerPolyfill";
import { applyDisplayObjectPolyfill } from "./displayObjectPolyfill";
import { yogaAnimationManager } from "./YogaAnimationManager";

if (!(<any>window).PIXI) {
    (<any>window).PIXI = PIXI;
}

export { YogaLayout, IYogaAnimationConfig } from "./YogaLayout";
export { YogaLayoutConfig } from "./YogaLayoutConfig";
export * from "./YogaContants";

export interface IFlexLayoutOptions {
    usePixiSharedTicker: boolean;
}

/**
 * Polyfills PIXI.DisplayObject and PIXI.Container
 *
 */
export function initializeYogaLayout(options: IFlexLayoutOptions = {usePixiSharedTicker: true}) {
    applyDisplayObjectPolyfill();
    applyContainerPolyfill();
    if (options.usePixiSharedTicker) {
        PIXI.ticker.shared.add(delta => yogaAnimationManager.update(delta));
    }
}
