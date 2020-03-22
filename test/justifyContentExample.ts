
export const justifyContentExample =`
const stageStyle = {
    width: app.renderer.width,
    height: app.renderer.height,
    alignItems: "center"
}

const buttonStyle = {
    paddingAll: 10,
    justifyContent: "center",
};

const buttonBackgroundStyle = {
    width: "100%",
    height: "100%",
    position: "absolute"
}

const button = new PIXI.Container();
button.yoga.fromConfig(buttonStyle);

const buttonText = new PIXI.Text();
const background = new PIXI.mesh.NineSlicePlane(PIXI.Texture.fromImage(bigImgPath), 7, 7, 7, 7)
background.yoga.fromConfig(buttonBackgroundStyle);
background.yoga.rescaleToYoga = true; // set PIXI width/height to math Yoga layout
button.addChild(background, buttonText);

app.stage.flexRecursive = true; // apply Yoga to ALL children
app.stage.yoga.fromConfig(stageStyle)
app.stage.addChild(new CountingText(), button, new CountingText());

const justify = ["center", "space-between", "space-around", "flex-start"];

function randJustify() {
  app.stage.yoga.justifyContent = justify[Math.floor(Math.random()*4)]
  buttonText.text = app.stage.yoga.justifyContent;
}
randJustify();
setInterval(randJustify, 3000)
`
