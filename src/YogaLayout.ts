import * as Yoga from "yoga-layout-prebuilt";
import { YogaConstants } from "./YogaContants";
import { YogaLayoutConfig } from "./YogaLayoutConfig";
import YogaEdges = YogaConstants.YogaEdges;
import DisplayObject = PIXI.DisplayObject;
import ComputedLayout = YogaConstants.ComputedLayout;
import FlexDirection = YogaConstants.FlexDirection;
import JustifyContent = YogaConstants.JustifyContent;
import Align = YogaConstants.Align;
import FlexWrap = YogaConstants.FlexWrap;
import Display = YogaConstants.Display;
import PositionType = YogaConstants.PositionType;

type PixelsOrPercentage = number | string;

export class YogaLayout {

    public static readonly LAYOUT_UPDATED_EVENT = "LAYOUT_UPDATED_EVENT";
    public static readonly NEED_LAYOUT_UPDATE = "NEED_LAYOUT_UPDATE";
    public readonly target: DisplayObject;
    public readonly node: Yoga.YogaNode;
    public children: YogaLayout[] = [];
    public parent?: YogaLayout;
    public rescale: boolean = false;

    private _width: PixelsOrPercentage | "pixi";
    private _height: PixelsOrPercentage | "pixi";
    private _cachedLayout: ComputedLayout | undefined;
    private _lastRecalculationDuration = 0;
    private _needUpdateAsRoot: boolean = false;

    private _aspectRatio: number;

    constructor(pixiObject: DisplayObject = new DisplayObject()) {
        this.node = Yoga.Node.create();
        this.fillDefaults();
        this.target = pixiObject;

        if ((<any>this.target)._texture) {
            this.width = this.height = "pixi";
        } else {
            this.width = this.height = "auto";
        }

        // broadcast event
        pixiObject.on(YogaLayout.LAYOUT_UPDATED_EVENT as any, () => {
            this._cachedLayout = undefined;
            this.children.forEach(child => child.target.emit(YogaLayout.LAYOUT_UPDATED_EVENT))
        })

        pixiObject.on(YogaLayout.NEED_LAYOUT_UPDATE as any, () => {
            if (!this.parent || (this.hasContantDeclaredSize && this.parent.width !== "auto" && this.parent.height !== "auto")) {
                this._needUpdateAsRoot = true;
            } else {
                this.parent.target.emit(YogaLayout.NEED_LAYOUT_UPDATE)
            }
        })
    }

    public fromConfig(config: YogaLayoutConfig) {
        Object.assign(this, config);
    }

    public copy(layout: YogaLayout): void {
        this.node.copyStyle(layout.node);
        this.rescale = layout.rescale;
        this.aspectRatio = layout.aspectRatio;
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
        this.node.insertChild(yoga.node, this.node.getChildCount())
        this.children.splice(index, 0, yoga);
        yoga.parent = this;
    }


    public removeChild(yoga: YogaLayout): void {
        this.children = this.children.filter(child => child === yoga);
        this.node.removeChild(yoga.node);
        yoga.parent = undefined;
    }

    public requestLayoutUpdate(): void {
        this.target.emit(YogaLayout.NEED_LAYOUT_UPDATE);
    }

    public recalculateLayout(): void {
        const start = performance.now()
        this.node.calculateLayout();
        this._lastRecalculationDuration = performance.now() - start;
        console.log("recalculated: ", this._lastRecalculationDuration, this)
        this.target.emit(YogaLayout.LAYOUT_UPDATED_EVENT);
    }

    public update(): void {
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

    public get computedLayout(): ComputedLayout {
        if (!this._cachedLayout) {
            this._cachedLayout = this.node.getComputedLayout();

            // YOGA FIX for percent widht/height for absolute positioned elements
            if (this.position === "absolute" && this.parent && this.node.getWidth().unit === Yoga.UNIT_PERCENT) {
                this._cachedLayout.width = Math.round(parseFloat(this._width as string) / 100 * this.parent.calculatedWidth)
            }

            if (this.position === "absolute" && this.parent && this.node.getHeight().unit === Yoga.UNIT_PERCENT) {
                this._cachedLayout.height = Math.round(parseFloat(this._height as string) / 100 * this.parent.calculatedHeight)
            }

            if (this.position === "absolute" && this.parent) {
                this._cachedLayout.left = this.node.getComputedMargin(Yoga.EDGE_LEFT);
                this._cachedLayout.top = this.node.getComputedMargin(Yoga.EDGE_TOP)
            }


            // YOGA FIX for padding
            // this._cachedLayout.width += this.node.getComputedPadding(Yoga.EDGE_LEFT);
            // this._cachedLayout.height += this.node.getComputedPadding(Yoga.EDGE_TOP);
            // this._cachedLayout.left -= this.node.getComputedPadding(Yoga.EDGE_LEFT);
            // this._cachedLayout.top -= this.node.getComputedPadding(Yoga.EDGE_TOP);

            // YOGA FIX for not working aspect ratio https://github.com/facebook/yoga/issues/677
            if (this._aspectRatio) {
                const newHeight = this.calculatedWidth / this._aspectRatio;
                this._cachedLayout.top += (this.calculatedHeight - newHeight) / 2;
                this._cachedLayout.height = newHeight;
                this.height = this.calculatedHeight;
            }
        }
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

    public get calculatedWidth(): number {
        return this._cachedLayout ? this._cachedLayout.width : this.node.getComputedWidth();
    }

    public get calculatedHeight(): number {
        return this._cachedLayout ? this._cachedLayout.height : this.node.getComputedHeight();
    }

    public set width(value: PixelsOrPercentage) {
        this._width = value;
        if (value !== "pixi") {
            this.node.setWidth(value);
        }
        this.requestLayoutUpdate();
    }

    public get width(): PixelsOrPercentage {
        return this._parseValue(this.node.getWidth());
    }

    public set height(value: PixelsOrPercentage) {
        this._height = value;
        if (value !== "pixi") {
            this.node.setHeight(value);
        }
        this.requestLayoutUpdate();
    }

    public get height(): PixelsOrPercentage {
        return this._parseValue(this.node.getHeight());
    }

    public set flexDirection(direction: keyof typeof FlexDirection) {
        this.node.setFlexDirection(<Yoga.YogaFlexDirection>YogaConstants.FlexDirection[direction]);
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
        this.node.setMargin(Yoga.EDGE_TOP, value)
        this.requestLayoutUpdate();
    }

    public get marginTop(): number {
        return this.node.getMargin(Yoga.EDGE_TOP).value || 0;
    }

    public set marginBottom(value: number) {
        this.node.setMargin(Yoga.EDGE_BOTTOM, value)
        this.requestLayoutUpdate();
    }

    public get marginBottom(): number {
        return this.node.getMargin(Yoga.EDGE_BOTTOM).value || 0;
    }

    public set marginLeft(value: number) {
        this.node.setMargin(Yoga.EDGE_LEFT, value)
        this.requestLayoutUpdate();
    }

    public get marginLeft(): number {
        return this.node.getMargin(Yoga.EDGE_LEFT).value || 0;
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
