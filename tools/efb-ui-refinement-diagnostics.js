/* Paste into the Coherent inspector separately for toolbar parent and tracker iframe. */
(function (root) {
  'use strict';
  function describe(node) {
    if (!node) return null;
    var rect = node.getBoundingClientRect(), style = root.getComputedStyle(node);
    return { tag:node.tagName, id:node.id, classes:String(node.className),
      display:style.display, visibility:style.visibility, opacity:style.opacity,
      overflow:style.overflow, fontFamily:style.fontFamily, fontSize:style.fontSize,
      width:node.clientWidth, height:node.clientHeight,
      rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height} };
  }
  function capture(label) {
    var text = root.document.getElementById('compassHdgReadout'), chain = [];
    for (var node = text; node; node = node.parentElement) chain.push(describe(node));
    var headingBox = null;
    try { if (text && text.getBBox) { var b=text.getBBox(); headingBox={x:b.x,y:b.y,width:b.width,height:b.height}; } } catch (_) {}
    return { label:String(label || ''), timestamp:new Date().toISOString(),
      viewport:{width:root.innerWidth,height:root.innerHeight,dpr:root.devicePixelRatio},
      scale:root.GAEfbUiScale ? root.GAEfbUiScale.state() : null,
      native:root.VfrToolbarDiagnostics ? root.VfrToolbarDiagnostics() : null,
      heading:{text:text ? text.textContent : null,bbox:headingBox,ancestors:chain,
        fontReady:root.document.fonts ? root.document.fonts.status : null,
        dsegLoaded:root.document.fonts && root.document.fonts.check ? root.document.fonts.check('15px DSEG7') : null},
      telemetry:describe(root.document.getElementById('routeProgressBar')),
      profile:['mapProfileCanvas','mapProfileCanvasBg'].map(function(id){
        var canvas=root.document.getElementById(id);if(!canvas)return null;
        var m=canvas.getContext('2d').getTransform ? canvas.getContext('2d').getTransform() : null;
        return {layout:describe(canvas),buffer:{width:canvas.width,height:canvas.height},transform:m ? [m.a,m.b,m.c,m.d,m.e,m.f] : null};
      }) };
  }
  root.GAEfbRefinementDiagnostics = { capture:capture };
})(window);
