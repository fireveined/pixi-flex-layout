import { IAnimationState } from "./YogaLayout";

export class YogaAnimationManager {

    public animations: IAnimationState[] = [];

    public update(delta: number): void {
        delta *= 16.6
        const toDelete = [];
        for (const anim of this.animations) {
            anim.elapsed += delta;
            let progress = anim.easing(anim.elapsed / anim.time);


            if (progress > 1) {
                progress = 1;
                toDelete.push(anim);
            }
            anim.curX = anim.fromX + (anim.toX - anim.fromX) * progress;
            anim.curY = anim.fromY + (anim.toY - anim.fromY) * progress;

        }


        for (const anim of toDelete) {
            this.remove(anim);
        }
    }

    public add(anim: IAnimationState) {
        this.animations.push(anim);
    }

    public remove(anim: IAnimationState) {
        this.animations.splice(this.animations.indexOf(anim), 1);
    }
}

export const yogaAnimationManager = new YogaAnimationManager();
