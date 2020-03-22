import { DisplayObject } from "pixi.js";
import { YogaLayout } from "./YogaLayout";
import Container = PIXI.Container;

declare module "pixi.js" {

    import { YogaLayout } from "./YogaLayout";

    export interface DisplayObject {
        yoga: YogaLayout;

        updateYogaLayout(): void;

        checkIfBoundingBoxChanged(): void;
    }

    export interface Container {
        flex: boolean;
        flexRecursive: boolean;
    }


}

export function initializeYogaLayout() {

    Object.defineProperty(Container.prototype, "flex", {
        get(): boolean {
            return this.__flex;
        },
        set(newFlex: boolean): void {
            if (!this.flex && newFlex) {
                this.children.forEach(child => {
                    this.yoga.addChild(child.yoga);
                    if (this.flexRecursive && child instanceof PIXI.Container) {
                        child.flexRecursive = true;
                    }
                });
                this.emit(YogaLayout.NEED_LAYOUT_UPDATE);
            }

            if (this.flex && !newFlex) {
                this.children.forEach(child => {
                    this.yoga.removeChild(child.yoga);
                });
            }
            this.__flex = newFlex;
        }
    });

    Object.defineProperty(Container.prototype, "flexRecursive", {
        get(): boolean {
            return this.__flexRecursive;
        },
        set(newFlex: boolean): void {
            this.__flexRecursive = newFlex;
            this.flex = newFlex;
        }
    });

    Object.defineProperty(DisplayObject.prototype, "yoga", {
        get(): boolean {
            if (!this.__yoga) {
                this.__yoga = new YogaLayout(this);
            }
            return this.__yoga;
        }
    });
    const addChild = Container.prototype.addChild;
    const addChildAt = Container.prototype.addChildAt;
    const removeChild = Container.prototype.removeChild;
    const updateTransform = DisplayObject.prototype.updateTransform;
    const containerUpdateTransform = Container.prototype.updateTransform;
    const destroy = DisplayObject.prototype.destroy;
    DisplayObject.prototype.destroy = function () {
        if (this.yoga) {
            this.yoga.node.free();
        }
        this.yoga.parent = undefined;
        delete this.yoga;
        destroy();
    }

    Container.prototype.addChild = function (...children) {
        const child = children[0];
        if (this.flex) {
            this.yoga.addChild(child.yoga);
        }

        if (this.flexRecursive && child instanceof PIXI.Container) {
            child.flexRecursive = true;
        }
        this.emit(YogaLayout.NEED_LAYOUT_UPDATE);
        return addChild.call(this, ...children) as any;
    }


    Container.prototype.addChildAt = function (child, index) {
        if (this.flex) {
            this.yoga.addChild(child.yoga, index);
        }

        if (this.flexRecursive && child instanceof PIXI.Container) {
            child.flexRecursive = true;
        }
        this.emit(YogaLayout.NEED_LAYOUT_UPDATE);
        return addChildAt.call(this, child, index) as any;
    }


    Container.prototype.removeChild = function (child) {
        if (this.flex) {
            this.yoga.removeChild(child.yoga);
        }
        this.emit(YogaLayout.NEED_LAYOUT_UPDATE);
        return removeChild.call(this, child) as any;
    }

    DisplayObject.prototype.updateTransform = function () {
        return updateTransform.call(this)
    }

    Container.prototype.updateTransform = function () {


        if (this.yoga && this.yoga.isRoot) {
            this.checkIfBoundingBoxChanged();
            this.updateYogaLayout();
        }

        return containerUpdateTransform.call(this)
    }


    DisplayObject.prototype.checkIfBoundingBoxChanged = function (this: DisplayObject) {
        if (this instanceof PIXI.Text) {
            (this as any).updateText(true);
        }

        this.yoga.children.forEach(child => {
            child.target.checkIfBoundingBoxChanged();
        })
        const texture: PIXI.Texture = (this as any)._texture;
        const bounds = (this as any)._boundsRect;

        if (texture) {
            const tw = Math.abs(this.yoga.rescale ? 1 : this.scale.x) * texture.orig.width;
            const th = Math.abs(this.yoga.rescale ? 1 : this.scale.y) * texture.orig.height;
            if (this.yoga.rescale && this instanceof PIXI.Text) {
                this.yoga.aspectRatio = (texture.orig.width / texture.orig.height)
            }
            (this as any).__layoutHash = tw * 3 + th * 121;

            if ((this as any).__layoutHash !== (this as any).__oldHash) {
                this.emit(YogaLayout.NEED_LAYOUT_UPDATE);
            }
            (this as any).__oldHash = (this as any).__layoutHash;

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

        (<any>this.transform).position.x = layout.left;
        (<any>this.transform).position.y = layout.top;

        const texture: PIXI.Texture = (this as any)._texture;
        if (this.yoga.rescale) {

            (<any>this).width !== undefined && ((<any>this).width = layout.width);
            (<any>this).height !== undefined && ((<any>this).height = layout.height);
        }

        this.yoga.children.forEach(child => {
            child.target.updateYogaLayout();
        })
    }
}
