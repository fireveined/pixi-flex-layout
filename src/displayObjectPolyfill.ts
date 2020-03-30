import { DisplayObject } from "pixi.js";
import { YogaLayout } from "./YogaLayout";
import TransformStatic = PIXI.TransformStatic;

const NineSlicePlane = (<any>PIXI).NineSlicePlane || (<any>PIXI).mesh.NineSlicePlane;

declare module "pixi.js" {
    export interface DisplayObject {
        yoga: YogaLayout;
        __hasYoga: boolean;

        updateYogaLayout(): void;

        checkIfBoundingBoxChanged(): void;
    }

    interface DisplayObject {
        _yogaLayoutHash: number;
        _prevYogaLayoutHash: number;
    }
}


export function applyDisplayObjectPolyfill() {

    Object.defineProperty(DisplayObject.prototype, "yoga", {
        get(): boolean {
            if (!this.__yoga) {
                this.__yoga = new YogaLayout(this);
                this.__hasYoga = true;
            }
            return this.__yoga;
        },
        set(v: any): void {
            this.__yoga = v;
        }
    });

    Object.defineProperty(DisplayObject.prototype, "visible", {
        get(): boolean {
            return this._visible;
        },
        set(v: any): void {
            this._visible = v;
            if (this.__hasYoga) {
                this.yoga.display = this._visible ? "flex" : "none";
            }
        }
    });

    const destroy = DisplayObject.prototype.destroy;
    DisplayObject.prototype.destroy = function () {
        if (this.yoga) {
            this.yoga.node.free();
        }
        this.yoga.parent = undefined;
        delete this.yoga;
        destroy.call(this);
    }

    DisplayObject.prototype.checkIfBoundingBoxChanged = function (this: DisplayObject) {
        if ((this as any).updateText) {
            (this as any).updateText(true);
        }

        this.yoga.children.forEach(child => {
            child.target.checkIfBoundingBoxChanged();
        })

        const texture: PIXI.Texture = (this as any)._texture;
        const bounds = (this as any)._boundsRect;

        if (texture) {
            let tw = Math.abs(this.yoga.rescaleToYoga ? 1 : this.scale.x) * texture.orig.width;
            let th = Math.abs(this.yoga.rescaleToYoga ? 1 : this.scale.y) * texture.orig.height;

            if (!this.yoga.rescaleToYoga && this instanceof NineSlicePlane) {
                tw = (<any>this).width;
                th = (<any>this).height;
            } else if (this.yoga.rescaleToYoga && (this instanceof PIXI.Text || this instanceof PIXI.Sprite)) {
                this.yoga.aspectRatio = (texture.orig.width / texture.orig.height)
            }

            this._yogaLayoutHash = tw * 0.12498 + th * 4121;
            if (this._yogaLayoutHash !== this._prevYogaLayoutHash) {
                this.emit(YogaLayout.NEED_LAYOUT_UPDATE);
            }
            this._prevYogaLayoutHash = this._yogaLayoutHash;

            this.yoga.isWidthCalculatedFromPixi && this.yoga.node.setWidth(tw);
            this.yoga.isHeightCalculatedFromPixi && this.yoga.node.setHeight(th);

        } else if (bounds) {
            this.yoga.isWidthCalculatedFromPixi && this.yoga.node.setWidth(bounds.width)
            this.yoga.isHeightCalculatedFromPixi && this.yoga.node.setHeight(bounds.height)
        }
    }

    DisplayObject.prototype.updateYogaLayout = function (this: DisplayObject) {
        this.yoga.update();
        const layout = this.yoga.computedLayout;

        (this.transform as TransformStatic).position.x = layout.left;
        (this.transform as TransformStatic).position.y = layout.top;

        if (this.yoga.rescaleToYoga) {
            (<any>this).width = layout.width;
            (<any>this).height = layout.height;
        }

        this.yoga.children.forEach(child => {
            child.target.updateYogaLayout();
        })
    }
}
