import * as Yoga from "yoga-layout-prebuilt-low-memory";
import { YogaConstants } from "./YogaContants";
import { YogaLayoutConfig } from "./YogaLayoutConfig";
import { yogaAnimationManager } from "./YogaAnimationManager";
import YogaEdges = YogaConstants.YogaEdges;
import DisplayObject = PIXI.DisplayObject;
import ComputedLayout = YogaConstants.ComputedLayout;
import FlexDirection = YogaConstants.FlexDirection;
import JustifyContent = YogaConstants.JustifyContent;
import Align = YogaConstants.Align;
import FlexWrap = YogaConstants.FlexWrap;
import Display = YogaConstants.Display;
import PositionType = YogaConstants.PositionType;

export type PixelsOrPercentage = number | string;
export type YogaSize = PixelsOrPercentage | "pixi" | "auto";


export interface IAnimationState {
    fromX: number;
    fromY: number;
    curX: number;
    curY: number;
    toX: number;
    toY: number;
    time: number;
    elapsed: number;
    easing: (progress: number) => number;
}

export interface IYogaAnimationConfig {
    time: number;
    easing: (progress: number) => number;

    shouldRunAnimation?(yoga: YogaLayout, prev: ComputedLayout, newLayout: ComputedLayout): boolean;

}

export class YogaLayout {

    /**
     * Internal value. True if we are currently in WebGLRenderer.render() (based on 'prerender' and 'postrender' events). Used to skip some updateTransform calls.
     */
    public static isRendering: boolean = true;

    /**
     * Experimental feature for building layouts independent of pixi tree
     */
    public static roots: Map<string, YogaLayout> = new Map();
    public static readonly LAYOUT_UPDATED_EVENT = "LAYOUT_UPDATED_EVENT";
    public static readonly AFTER_LAYOUT_UPDATED_EVENT = "AFTER_LAYOUT_UPDATED_EVENT";
    public static readonly NEED_LAYOUT_UPDATE = "NEED_LAYOUT_UPDATE";
    public readonly target: DisplayObject;
    public readonly node: Yoga.YogaNode;
    public children: YogaLayout[] = [];
    public parent?: YogaLayout;


    /**
     * If set, position transitions will be animated
     */
    public animationConfig: IYogaAnimationConfig;

    /**
     * True if Yoga should manage PIXI objects width/height
     */
    public rescaleToYoga: boolean = false;

    /**
     * If true and rescaleToYoga===true, resizing will keep aspect ratio of obejct.
     * Defaults to true on PIXI.Text and PIXI.Sprite.
     */
    public keepAspectRatio: boolean | undefined;

    private _width: YogaSize;
    private _height: YogaSize;
    private _cachedLayout: ComputedLayout | undefined;
    private _lastLayout: ComputedLayout | undefined;
    private _lastRecalculationDuration = 0;
    private _animation: IAnimationState;


    /**
     * Will be recalculated in next frame
     */
    private _needUpdateAsRoot: boolean = false;

    /**
     * Used instead of Yoga.AspectRatio because of Yoga issue https://github.com/facebook/yoga/issues/677
     */
    private _aspectRatio: number;

    private _gap: number = 0;


    /**
     * Internal values stored to reduce calls to nbind
     */
    private _marginTop: number = 0;
    private _marginLeft: number = 0;

    constructor(pixiObject: DisplayObject = new DisplayObject()) {
        this.node = Yoga.Node.create();
        pixiObject.__hasYoga = true;
        this.fillDefaults();
        this.target = pixiObject;
        if ((<any>this.target)._texture) {
            this.width = this.height = "pixi";
        } else {
            this.width = this.height = "auto";
        }

        if (pixiObject instanceof PIXI.Text || pixiObject instanceof PIXI.Sprite) {
            this.keepAspectRatio = true;
        }

        // broadcast event
        pixiObject.on(YogaLayout.LAYOUT_UPDATED_EVENT as any, () => {
            this._lastLayout = this._cachedLayout;
            this._cachedLayout = undefined;
            this.children.forEach(child => child.target.emit(YogaLayout.LAYOUT_UPDATED_EVENT))
        })

        pixiObject.on(YogaLayout.NEED_LAYOUT_UPDATE as any, () => {
            // size change of this element wont change size/positions of its parent, so there is no need to update whole tree
            if (!this.parent /*|| (this.hasContantDeclaredSize && this.parent.width !== "auto" && this.parent.height !== "auto")*/) {
                this._needUpdateAsRoot = true;
            } else {
                this.parent.target.emit(YogaLayout.NEED_LAYOUT_UPDATE)
            }
        })
    }

    public get animationState(): Readonly<IAnimationState> {
        return this._animation;
    }

    public set root(val: string) {
        const root = YogaLayout.roots.get(val);
        if (root) {
            root.addChild(this);
        }
    }

    /**
     * Assigns given properties to this yoga layout
     * @param config
     */
    public fromConfig(config: YogaLayoutConfig) {
        Object.assign(this, config);
    }

    /**
     * Same as 'fromConfig()'
     * @param config
     */
    public set config(config: YogaLayoutConfig) {
        this.fromConfig(config);
    }

    /**
     * Copies all properties (styles, size, rescaleToYoga etc) from other YogaLayout objects
     * @param layout
     */
    public copy(layout: YogaLayout): void {
        this.node.copyStyle(layout.node);
        this.rescaleToYoga = layout.rescaleToYoga;
        this.aspectRatio = layout.aspectRatio;
        this.keepAspectRatio = layout.keepAspectRatio;
        this._width = layout._width;
        this._height = layout._height;
    }

    public fillDefaults() {
        this.node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
        this.node.setAlignItems(Yoga.ALIGN_FLEX_START);
        this.node.setAlignContent(Yoga.ALIGN_FLEX_START)
        this.node.setWidth("auto");
        this.node.setHeight("auto");
    }

    public addChild(yoga: YogaLayout, index = this.node.getChildCount()): void {
        if (yoga.parent) {
            yoga.parent.removeChild(yoga);
        }
        this.node.insertChild(yoga.node, index)
        this.children.splice(index, 0, yoga);
        yoga.parent = this;
        this.updateGap();
    }


    public removeChild(yoga: YogaLayout): void {
        const length = this.children.length;
        this.children = this.children.filter(child => child !== yoga);
        if (length !== this.children.length) {
            this.node.removeChild(yoga.node);
        }
        yoga.parent = undefined;
    }

    /**
     * Mark object as dirty and request layout recalculation
     */
    public requestLayoutUpdate(): void {
        this.target.emit(YogaLayout.NEED_LAYOUT_UPDATE);
    }

    public recalculateLayout(): void {
        const start = performance.now()
        this.node.calculateLayout();
        this._lastRecalculationDuration = performance.now() - start;
        // console.log("recalculated: ", this._lastRecalculationDuration, this)
        this.target.emit(YogaLayout.LAYOUT_UPDATED_EVENT);
    }

    public update(): void {
        if (!this.target.parent && this.parent) {
            this.parent.removeChild(this);
            return;
        }

        if (this._needUpdateAsRoot && !this.parent) {
            this.recalculateLayout();
        }
        this._needUpdateAsRoot = false;
    }

    public get isRoot(): boolean {
        return !this.parent;
    }

    /**
     * Returns true if object size is independent of its children sizes.
     */
    public get hasContantDeclaredSize(): boolean {
        return !!this._width && this._width !== "pixi" && this._width !== "auto"
            && !!this._height && this._height !== "pixi" && this._height !== "auto";
    }

    public willLayoutWillBeRecomputed(): boolean {
        return !this._cachedLayout;
    }

    public getComputedLayout(): ComputedLayout {
        if (!this._cachedLayout) {
            this._cachedLayout = this.node.getComputedLayout();

            // YOGA FIX for percent widht/height for absolute positioned elements
            if (this.position === "absolute" && this.parent && this.node.getWidth().unit === Yoga.UNIT_PERCENT) {
                this._cachedLayout.width = Math.round(parseFloat(this._width as string) / 100 * this.parent.calculatedWidth)
            }

            if (this.position === "absolute" && this.parent && this.node.getHeight().unit === Yoga.UNIT_PERCENT) {
                this._cachedLayout.height = Math.round(parseFloat(this._height as string) / 100 * this.parent.calculatedHeight)
            }

            // if (this.position === "absolute" && this.parent && !this.bottom && !this.right) {
            //     this._cachedLayout.left = this.node.getComputedMargin(Yoga.EDGE_LEFT);
            //     this._cachedLayout.top = this.node.getComputedMargin(Yoga.EDGE_TOP)
            // }

            // YOGA FIX for not working aspect ratio https://github.com/facebook/yoga/issues/677
            if (this._aspectRatio && this.keepAspectRatio) {
                const newWidth = this.calculatedHeight / this._aspectRatio;
             //   this._cachedLayout.top += (this.calculatedHeight - newHeight) / 2;
                this._cachedLayout.width = newWidth;
                this.height = this.calculatedHeight;
            }

            if (this.animationConfig && (!this.animationConfig.shouldRunAnimation || this.animationConfig.shouldRunAnimation(this, this._lastLayout || this._cachedLayout, this._cachedLayout))) {
                this._animation = {
                    fromX: this._lastLayout?.left || this._cachedLayout.left,
                    fromY: this._lastLayout?.top || this._cachedLayout.top,
                    curX: this._lastLayout?.left || this._cachedLayout.left,
                    curY: this._lastLayout?.top || this._cachedLayout.top,
                    toX: this._cachedLayout.left,
                    toY: this._cachedLayout.top,
                    time: this.animationConfig.time,
                    elapsed: 0,
                    easing: this.animationConfig.easing
                }

                yogaAnimationManager.add(this._animation);
            } else {
                this._animation = <any>{
                    curX: this._cachedLayout.left,
                    curY: this._cachedLayout.top
                }
            }

        }

        this._cachedLayout.left = this._animation.curX;
        this._cachedLayout.top = this._animation.curY;

        return this._cachedLayout;
    }

    public set aspectRatio(value: number) {
        if (this._aspectRatio === value) {
            return;
        }
        this._aspectRatio = value;
        this.requestLayoutUpdate();
    }

    public get aspectRatio(): number {
        return this._aspectRatio;
    }

    public get isWidthCalculatedFromPixi(): boolean {
        return this._width === "pixi"
    }

    public get isHeightCalculatedFromPixi(): boolean {
        return this._height === "pixi"
    }

    /**
     * Returns computed width in pixels
     */
    public get calculatedWidth(): number {
        return this._cachedLayout ? this._cachedLayout.width : this.node.getComputedWidth();
    }

    /**
     * Returns computed height in pixels
     */
    public get calculatedHeight(): number {
        return this._cachedLayout ? this._cachedLayout.height : this.node.getComputedHeight();
    }

    /**
     * Can handle:
     * - pixels (eg 150)
     * - percents ("50%")
     * - "auto" to use values from yoga
     * - "pixi" to use DisplayObject.width/height
     * @param value
     */
    public set width(value: YogaSize) {
        if (this._width === value) {
            return;
        }
        this._width = value;
        if (value !== "pixi") {
            this.node.setWidth(value);
        }
        this.requestLayoutUpdate();
    }

    public get width(): YogaSize {
        return this._parseValue(this.node.getWidth());
    }

    /**
     * Can handle:
     * - pixels (eg 150)
     * - percents ("50%")
     * - "auto" to use values from yoga
     * - "pixi" to use DisplayObject.width/height
     * @param value
     */
    public set height(value: YogaSize) {
        if (this._height === value) {
            return;
        }
        this._height = value;
        if (value !== "pixi") {
            this.node.setHeight(value);
        }
        this.requestLayoutUpdate();
    }

    public get height(): YogaSize {
        return this._parseValue(this.node.getHeight());
    }

    public set flexDirection(direction: keyof typeof FlexDirection) {
        this.node.setFlexDirection(<Yoga.YogaFlexDirection>YogaConstants.FlexDirection[direction]);
        this.updateGap();
        this.requestLayoutUpdate();
    }

    public get flexDirection(): keyof typeof FlexDirection {
        return YogaConstants.FlexDirection[this.node.getFlexDirection()] as any;
    }

    public set justifyContent(just: keyof typeof JustifyContent) {
        this.node.setJustifyContent(<Yoga.YogaJustifyContent>YogaConstants.JustifyContent[just]);
        this.requestLayoutUpdate();
    }

    public get justifyContent(): keyof typeof JustifyContent {
        return YogaConstants.JustifyContent[this.node.getJustifyContent()] as any;
    }

    public set alignContent(align: keyof typeof Align) {
        this.node.setAlignContent(<Yoga.YogaAlign>YogaConstants.Align[align]);
        this.requestLayoutUpdate();
    }

    public get alignContent(): keyof typeof Align {
        return YogaConstants.Align[this.node.getAlignContent()] as any;
    }

    public set alignItems(align: keyof typeof Align) {
        this.node.setAlignItems(<Yoga.YogaAlign>YogaConstants.Align[align]);
        this.requestLayoutUpdate();
    }

    public get alignItems(): keyof typeof Align {
        // @ts-ignore
        return YogaConstants.Align[this.node.getAlignItems()];
    }

    public set alignSelf(align: keyof typeof Align) {
        this.node.setAlignSelf(<Yoga.YogaAlign>YogaConstants.Align[align]);
        this.requestLayoutUpdate();
    }

    public get alignSelf(): keyof typeof Align {
        // @ts-ignore
        return YogaConstants.Align[this.node.getAlignSelf()];
    }

    public set flexWrap(wrap: keyof typeof FlexWrap) {
        this.node.setFlexWrap(<Yoga.YogaFlexWrap>YogaConstants.FlexWrap[wrap]);
        this.requestLayoutUpdate();
    }

    public get flexWrap(): keyof typeof FlexWrap {
        // @ts-ignore
        return YogaConstants.FlexWrap[this.node.getFlexWrap()];
    }

    public set flexGrow(grow: number) {
        this.node.setFlexGrow(grow)
        this.requestLayoutUpdate();
    }

    public get flexGrow(): number {
        return this.node.getFlexGrow();
    }

    public set flexShrink(shrink: number) {
        this.node.setFlexShrink(shrink);
        this.requestLayoutUpdate();
    }

    public get flexShrink(): number {
        return this.node.getFlexShrink();
    }

    public set flexBasis(basis: number) {
        this.node.setFlexBasis(basis);
        this.requestLayoutUpdate();
    }

    public get flexBasis(): number {
        return this.node.getFlexBasis();
    }

    public set position(type: keyof typeof PositionType) {
        this.node.setPositionType(<Yoga.YogaPositionType>YogaConstants.PositionType[type]);
        this.requestLayoutUpdate();
    }

    public get position(): keyof typeof PositionType {
        // @ts-ignore
        return YogaConstants.PositionType[this.node.getPositionType()];
    }

    public set padding(margin: number[]) {
        YogaEdges.forEach((edge, index) => {
            const value = margin[index];
            this.node.setPadding(edge, value)
        })
        this.requestLayoutUpdate();
    }

    public get padding(): number[] {
        return YogaEdges.map(edge => this.node.getPadding(edge).value || 0);
    }

    public set paddingAll(value: number) {
        this.padding = [value, value, value, value];
    }

    public set paddingTop(value: number) {
        this.node.setPadding(Yoga.EDGE_TOP, value)
        this.requestLayoutUpdate();
    }

    public get paddingTop(): number {
        return this.node.getPadding(Yoga.EDGE_TOP).value || 0;
    }

    public set paddingBottom(value: number) {
        this.node.setPadding(Yoga.EDGE_BOTTOM, value)
        this.requestLayoutUpdate();
    }

    public get paddingBottom(): number {
        return this.node.getPadding(Yoga.EDGE_BOTTOM).value || 0;
    }

    public set paddingLeft(value: number) {
        this.node.setPadding(Yoga.EDGE_LEFT, value)
        this.requestLayoutUpdate();
    }

    public get paddingLeft(): number {
        return this.node.getPadding(Yoga.EDGE_LEFT).value || 0;
    }

    public set paddingRight(value: number) {
        this.node.setPadding(Yoga.EDGE_RIGHT, value)
        this.requestLayoutUpdate();
    }

    public get paddingRight(): number {
        return this.node.getPadding(Yoga.EDGE_RIGHT).value || 0;
    }

    public set margin(margin: number[]) {
        YogaEdges.forEach((edge, index) => {
            const value = margin[index];
            this.node.setMargin(edge, value)
        })
        this.requestLayoutUpdate();
    }

    public set marginAll(value: number) {
        this.margin = [value, value, value, value];
    }

    public get margin(): number[] {
        return YogaEdges.map(edge => this.node.getMargin(edge).value || 0);
    }


    public set marginTop(value: number) {
        if (this._marginTop !== value) {
            this._marginTop = value;
            this.node.setMargin(Yoga.EDGE_TOP, value)
            this.requestLayoutUpdate();
        }
    }

    public get marginTop(): number {
        return this._marginTop;
    }

    public set marginBottom(value: number) {
        this.node.setMargin(Yoga.EDGE_BOTTOM, value)
        this.requestLayoutUpdate();
    }

    public get marginBottom(): number {
        return this.node.getMargin(Yoga.EDGE_BOTTOM).value || 0;
    }

    public set marginLeft(value: number) {
        if (this._marginLeft !== value) {
            this._marginLeft = value;
            this.node.setMargin(Yoga.EDGE_LEFT, value)
            this.requestLayoutUpdate();
        }
    }

    public get marginLeft(): number {
        return this._marginLeft;
    }

    public set marginRight(value: number) {
        this.node.setMargin(Yoga.EDGE_RIGHT, value)
        this.requestLayoutUpdate();
    }

    public get marginRight(): number {
        return this.node.getMargin(Yoga.EDGE_RIGHT).value || 0;
    }

    public set border(margin: number[]) {
        YogaEdges.forEach((edge, index) => {
            const value = margin[index];
            this.node.setBorder(edge, value)
        })
        this.requestLayoutUpdate();
    }

    public get border(): number[] {
        return YogaEdges.map(edge => this.node.getBorder(edge));
    }

    public set borderAll(value: number) {
        this.border = [value, value, value, value];
    }

    public set borderTop(value: number) {
        this.node.setBorder(Yoga.EDGE_TOP, value)
        this.requestLayoutUpdate();
    }

    public get borderTop(): number {
        return this.node.getBorder(Yoga.EDGE_TOP);
    }

    public set borderBottom(value: number) {
        this.node.setBorder(Yoga.EDGE_BOTTOM, value)
        this.requestLayoutUpdate();
    }

    public get borderBottom(): number {
        return this.node.getBorder(Yoga.EDGE_BOTTOM);
    }

    public set borderLeft(value: number) {
        this.node.setBorder(Yoga.EDGE_LEFT, value)
        this.requestLayoutUpdate();
    }

    public get bordereft(): number {
        return this.node.getBorder(Yoga.EDGE_LEFT);
    }

    public set borderRight(value: number) {
        this.node.setBorder(Yoga.EDGE_RIGHT, value)
        this.requestLayoutUpdate();
    }

    public get borderRight(): number {
        return this.node.getBorder(Yoga.EDGE_RIGHT);
    }

    public set top(value: PixelsOrPercentage) {
        this.node.setPosition(Yoga.EDGE_TOP, value)
        this.requestLayoutUpdate();
    }

    public get top(): PixelsOrPercentage {
        return this._parseValue(this.node.getPosition(Yoga.EDGE_TOP));
    }

    public set bottom(value: PixelsOrPercentage) {
        this.node.setPosition(Yoga.EDGE_BOTTOM, value)
        this.requestLayoutUpdate();
    }

    public get bottom(): PixelsOrPercentage {
        return this._parseValue(this.node.getPosition(Yoga.EDGE_BOTTOM));
    }

    public set left(value: PixelsOrPercentage) {
        this.node.setPosition(Yoga.EDGE_LEFT, value)
        this.requestLayoutUpdate();
    }

    public get left(): PixelsOrPercentage {
        return this._parseValue(this.node.getPosition(Yoga.EDGE_LEFT));
    }

    public set right(value: PixelsOrPercentage) {
        this.node.setPosition(Yoga.EDGE_RIGHT, value)
        this.requestLayoutUpdate();
    }

    public get right(): PixelsOrPercentage {
        return this._parseValue(this.node.getPosition(Yoga.EDGE_RIGHT));
    }

    public set minWidth(value: PixelsOrPercentage) {
        this.node.setMinWidth(value);
        this.requestLayoutUpdate();
    }

    public get minWidth(): PixelsOrPercentage {
        return this._parseValue(this.node.getMinWidth())
    }

    public set minHeight(value: PixelsOrPercentage) {
        this.node.setMinHeight(value);
        this.requestLayoutUpdate();
    }

    public get minHeight(): PixelsOrPercentage {
        return this._parseValue(this.node.getMinHeight())
    }

    public set maxWidth(value: PixelsOrPercentage) {
        this.node.setMaxWidth(value);
        this.requestLayoutUpdate();
    }

    public get maxWidth(): PixelsOrPercentage {
        return this._parseValue(this.node.getMaxWidth())
    }

    public set maxHeight(value: PixelsOrPercentage) {
        this.node.setMaxHeight(value);
        this.requestLayoutUpdate();
    }

    public get maxHeight(): PixelsOrPercentage {
        return this._parseValue(this.node.getMaxHeight())
    }

    public set display(value: keyof typeof Display) {
        this.node.setDisplay(<Yoga.YogaDisplay>YogaConstants.Display[value]);
        this.requestLayoutUpdate();
    }

    public get display(): keyof typeof Display {
        // @ts-ignore
        return Display[this.node.getDisplay()];
    }

    public set gap(val: number) {
        if (this._gap === val) {
            return;
        }
        this._gap = val;
        this.updateGap();
        this.requestLayoutUpdate();
    }

    public get gap() {
        return this._gap;
    }

    public updateGap(): void {
        if (!this._gap) {
            return;
        }

        let firstChildrenSkipped = false;
        this.children.forEach((child, index) => {
            if (firstChildrenSkipped) {
                this.flexDirection === "column" ? child.marginTop = this._gap : child.marginLeft = this._gap;
            }

            if (child.position !== "absolute") {
                firstChildrenSkipped = true;
            }
        })
    }

    private _parseValue(value: { unit: any, value: any }): PixelsOrPercentage {
        if (value.unit === Yoga.UNIT_POINT) {
            return parseFloat(value.value)
        }

        if (value.unit === Yoga.UNIT_PERCENT) {
            return value.value.toString() + "%";
        }

        if (value.unit === Yoga.UNIT_AUTO) {
            return "auto";
        }
        return undefined as any;
    }


}
