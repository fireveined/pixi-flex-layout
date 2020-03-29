
export class CountingText extends PIXI.Text {

    public interval: any;

    constructor(minLength = 1, maxLength: number = 6, time = 1000) {
        super();
        this.text = (2131 * Math.random()).toString().slice(0, minLength)
        this.interval = setInterval(() => {
            this.text += Math.random().toString()[3];

            if (this.text.length > maxLength) {
                this.text = (2131 * Math.random()).toString().slice(0, minLength)
            }
        }, time)
    }

    public destroy(options?: PIXI.DestroyOptions | boolean): void {
        clearInterval(this.interval)
        super.destroy(options)
    }
}
