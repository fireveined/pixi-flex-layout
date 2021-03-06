# pixi-flex-layout

[![NPM Version][npm-image]][npm-url]

Flex layouts for pixi.js (both v4 and v5) powered by [Yoga](https://yogalayout.com/)
![example](test/space-around.png)
# Installation

```
npm install pixi-flex-layout --save
```

# Usage
```javascript
import { initializeYogaLayout, yogaSetRenderer } from "pixi-flex-layout";
initializeYogaLayout();
yogaSetRenderer(pixiRenderer);

const containerStyle  = {
    justifyContent: "space-between",
    flexWrap: "wrap",
    width: 200
};

const container = new PIXI.Container();
container.flex = true;
container.yoga.fromConfig(containerStyle)
container.yoga.flexDirection = "row";
container.yoga.animationConfig = {
    time: 200,
    easing: t => t
}

for(let i =0; i < 10;i++){
  const foo = new PIXI.Text(i+"00");
  container.addChild(foo)
}

```

Live and editable examble can be found on https://fireveined.github.io/pixi-flex-layout/test.html

TypeDoc on https://fireveined.github.io/pixi-flex-layout/doc/index.html

#### Initializing flex
_initializeYogaLayout(options: IFlexLayoutOptions)_
> Invoke once on app startup to initialize pixi.js polyfills. 
Supported options: usePixiSharedTicker: boolean, default true

_yogaSetRenderer(renderer: renderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer)_
> pixi-flex-layout will use renderer events to prevent unnecessary updateTransform calls. It's not neccesary, but will speed up calculations a lot.

_PIXI.Container.flex: boolean_
> True to enable flex layout for direct children of container, or false to disable flex when flexRecursive is set

_PIXI.Container.flexRecursive: boolean_
> True to enable flex layout for ALL children of container (eg. whole scene)

_DisplayObject.\_\_hasYoga: boolean
> Checks if object has Yoga node bound

#### Setting styles

Styles can be se directly:
```javascript
object.yoga.width = "50%";
object.yoga.paddingTop = 20;
object.yoga.alignItems = "center";
```

Or using config
```javascript
const containerStyle: YogaLayoutConfig  = {
    justifyContent: "space-between",
    flexWrap: "wrap",
    width: 200
};
object.yoga.fromConfig(containerStyle);
```

All styles from https://yogalayout.com/ are suported with shorthands for:
```javascript
obj.yoga.padding = [10, 10, 10, 10];
obj.yoga.paddingAll = 10;  
obj.yoga.paddingTop = 30;
```
The same for `margin` and `border` properties.

#### Size controlling
`obj.yoga.rescaleToYoga: boolean` can be used and then pixi width/height will be controlled by yoga and set to match layout values.

`obj.yoga.keepAspectRatio: boolean` can be used to keep aspect ratio of objects. Defaults to true on PIXI.Text and PIXI.Sprite.

`obj.yoga.[width|height]` can take values: 
```js
obj.yoga.width = 100; // pixels
obj.yoga.height = "30%" // 30% of parent
obj.yoga.width = "auto"; // default 
obj.yoga.height = "pixi"; // use value from PIXIobject.height property 
```

### Animations

Animations can be enabled by setting animationConfig:

```typescript
obj.yoga.animationConfig = {
    time: 200 // duration of animation in ms
    easing: t => t 
}
```
### Todos

 - Build and use new Yoga version (current yoga-layout-prebuilt is quite old)
 - More readable doc with examples
 - Support for font baselines


### Known bugs
 
 - minWidth/minHeight/maxWidth/maxHeight sometimes don't work as expected when commbined with position: absolute or paddings/margins (Yoga bug)
 
 
License
----

MIT


[npm-image]: https://img.shields.io/npm/v/pixi-flex-layout.svg
[npm-url]: https://npmjs.org/package/pixi-flex-layout
