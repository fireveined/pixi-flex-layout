import "pixi.js"
import bigImg from './big.png'
import { YogaLayoutConfig } from "../src/YogaLayoutConfig";
import * as CM from "./lib/codemirror"
import * as JS from "./mode/javascript/javascript"
import NineSlicePlane = PIXI.mesh.NineSlicePlane;
import { createExample } from "./testRunner";
import { justifyContentExample } from "./justifyContentExample";


//
// const container = new PIXI.Container();
// container.flex = true;
// container.yoga.flexWrap = "wrap"
// container.yoga.flexDirection = "row";
// container.yoga.width = 2800;
// container.scale.set(0.2);
//
// const count = 220;
// let currentContainer: PIXI.Container;
// for (let i = 0; i < count; i++) {
//
//     if (i % 30 === 0) {
//         currentContainer = new PIXI.Container();
//         currentContainer.flex = true;
//         currentContainer.yoga.flexWrap = "wrap"
//         currentContainer.yoga.flexDirection = "row";
//         currentContainer.yoga.width = 1200;
//         currentContainer.yoga.justifyContent = "space-around";
//         currentContainer.yoga.alignContent = "space-around";
//         container.addChild(currentContainer);
//     }
//     const obj = PIXI.Sprite.fromImage(Math.random() > 0.5 ? smallImg : bigImg)
//
//     if (Math.random() > 0.95) {
//         const txt = new PIXI.Text(Math.random().toString());
//         currentContainer.addChild(txt);
//     }
//     currentContainer.addChild(obj);
// }





createExample(justifyContentExample)
