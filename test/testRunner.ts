import "pixi.js"
import { initializeYogaLayout } from "../src";
import bigImg from './big.png'
import smallImg from './small.png'
import * as CM from "./lib/codemirror"
import "./mode/javascript/javascript"
import { CountingText as CountingTextImport } from "./countingText";


const CountingText = CountingTextImport;
const CodeMirror = CM.default;

let intervals = [];

let oldSetInterval = window.setInterval;
window.setInterval = (func, time) => intervals.push(oldSetInterval(func, time));

export function createExample(code: string) {

    initializeYogaLayout();
    const canvas = document.querySelector("canvas");
    var app = new PIXI.Application({
        width: 800, height: 300,
        backgroundColor: 0x1099bb,
        autoStart: true,
        sharedTicker: true,
        view: canvas
    });

    const bigImgPath = bigImg;
    const smallImgPath = smallImg;

    try {
        app.stage.removeChildren()
        eval(code)
    } catch (err) {
        console.error(err)
    }

    var editor = CodeMirror.fromTextArea(document.querySelector("#editor"), {
        lineNumbers: true,
        mode: "javascript",
        value: code
    });


    editor.setValue(code);
    document.querySelector("#run").addEventListener("click", () => {
        intervals.forEach(interval => clearInterval(interval))
        intervals = [];
        const code = editor.getValue();
        try {
            app.stage.removeChildren()
            eval(code)
        } catch (err) {
            app.stage.addChild(new PIXI.Text("Error, open devtools console for more info :("))
            console.error(err)
        }
    })

}
