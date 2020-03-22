import "pixi.js"
import { initializeYogaLayout } from "../src/displayObjectPolyfill";
import smallImg from './test.png'
import bigImg from './big.png'
import { YogaLayoutConfig } from "../src/YogaLayoutConfig";
import NineSlicePlane = PIXI.mesh.NineSlicePlane;

initializeYogaLayout();
var app = new PIXI.Application(800, 600, {backgroundColor: 0x1099bb, autoStart: true, sharedTicker: true});
document.body.appendChild(app.view);

// create a new Sprite from an image path


const container = new PIXI.Container();
container.flex = true;
container.yoga.flexWrap = "wrap"
container.yoga.flexDirection = "row";
container.yoga.width = 2800;
container.scale.set(0.2);

const count = 220;
let currentContainer: PIXI.Container;
for (let i = 0; i < count; i++) {

    if (i % 30 === 0) {
        currentContainer = new PIXI.Container();
        currentContainer.flex = true;
        currentContainer.yoga.flexWrap = "wrap"
        currentContainer.yoga.flexDirection = "row";
        currentContainer.yoga.width = 1200;
        currentContainer.yoga.justifyContent = "space-around";
        currentContainer.yoga.alignContent = "space-around";
        container.addChild(currentContainer);
    }
    const obj = PIXI.Sprite.fromImage(Math.random() > 0.5 ? smallImg : bigImg)

    if (Math.random() > 0.95) {
        const txt = new PIXI.Text(Math.random().toString());
        currentContainer.addChild(txt);
    }
    currentContainer.addChild(obj);
}

const buttonStyle: YogaLayoutConfig = {
    paddingAll: 100,
    justifyContent: "center",
};

const textStyle: YogaLayoutConfig = {}

const button = new PIXI.Container();
button.flex = true;
button.yoga.fromConfig(buttonStyle);

const text = new PIXI.Text("100000");
const background = new NineSlicePlane(PIXI.Texture.fromImage(bigImg), 7, 7, 7, 7)


background.yoga.position = "absolute";
background.yoga.rescale = true;
background.yoga.width = "100%";
background.yoga.height = "100%";

text.yoga.fromConfig(textStyle)


button.addChild(background);
button.addChild(text)

app.stage.flex = true;

app.stage.yoga.justifyContent = "center";
app.stage.yoga.alignItems = "center";
app.stage.yoga.width = app.renderer.width;
app.stage.yoga.height = app.renderer.height;
app.stage.addChild(new PIXI.Text(Math.random().toString()), button, new PIXI.Text(Math.random().toString()));
console.log("child added");

