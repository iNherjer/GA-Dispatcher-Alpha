(function () {
  'use strict';
  var images = {}, remaining = 0;
  var pattern = Object.keys(gaEfbSymbolArtwork).filter(function(k){return k.length > 0;}).sort(function(a,b){return b.length-a.length;}).map(function(key){
    return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u200d/g, '\uFE0F?\u200d');
  }).join('|');
  window.gaEfbSymbolPattern = function(){return new RegExp(pattern || '(?!)','g');};
  window.gaEfbSymbolImage = function (text, color) {
    var key = String(text).replace(/\uFE0F/g, '');
    var artwork = gaEfbSymbolArtwork[key];
    if (!artwork) return null;
    if (artwork.indexOf('#eeeeee') !== -1 && typeof color === 'string' && /^(#[0-9a-f]+|rgba?\([\d., %]+\))$/i.test(color)) {
      artwork=artwork.replace(/#eeeeee/g,color);key+=':'+color;
    }
    if (!images[key]) {
      var img = new Image();
      remaining++;
      img.onload = img.onerror = function(){
        remaining--;
        if (!remaining && typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artwork);
      images[key] = img;
    }
    return images[key];
  };
  window.gaEfbCanvasFillText = function (ctx, text, x, y, maxWidth) {
    var value=String(text), regex=window.gaEfbSymbolPattern(), match, parts=[], offset=0;
    while ((match=regex.exec(value))) {
      if(match.index>offset)parts.push({text:value.slice(offset,match.index)});
      parts.push({image:window.gaEfbSymbolImage(match[0],ctx.fillStyle)});
      offset=regex.lastIndex;
      if(value.charAt(offset)==='\uFE0F')regex.lastIndex=++offset;
    }
    if(!offset){
      if(maxWidth===undefined)ctx.fillText(text,x,y);else ctx.fillText(text,x,y,maxWidth);
      return;
    }
    if(offset<value.length)parts.push({text:value.slice(offset)});
    var size=parseFloat((ctx.font.match(/([\d.]+)px/)||[0,'12'])[1]), total=0;
    parts.forEach(function(p){p.width=p.image?size:ctx.measureText(p.text).width;total+=p.width;});
    var scale=maxWidth>0&&total>maxWidth?maxWidth/total:1;
    if(ctx.textAlign==='center')x-=total*scale/2;
    else if(ctx.textAlign==='right'||ctx.textAlign==='end')x-=total*scale;
    var top=ctx.textBaseline==='middle'?-size/2:ctx.textBaseline==='bottom'||ctx.textBaseline==='ideographic'?-size:ctx.textBaseline==='top'||ctx.textBaseline==='hanging'?0:-size*.8;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,1);ctx.textAlign='left';
    var at=0;
    parts.forEach(function(p){
      if(p.image){if(p.image.complete&&p.image.naturalWidth)ctx.drawImage(p.image,at,top,size,size);}
      else ctx.fillText(p.text,at,0);
      at+=p.width;
    });
    ctx.restore();
  };
  window.gaEfbRefreshDrawerLayout = function () {
    var drawer = document.getElementById('mapSideDrawer');
    if (!drawer) return;
    var mobile = window.innerWidth <= 768;
    // Same limits as styles.css; min() inside a custom property fails in GT.
    drawer.style.setProperty('--checklist-panel-width', mobile ? '94vw' : '86vw');
    var panel=drawer.querySelector('.map-side-drawer-panel');
    var width=panel && parseFloat(getComputedStyle(panel).width);
    if (width>0) drawer.style.setProperty('--checklist-panel-width', Math.min(width, mobile ? 420 : 390) + 'px');
  };
  window.addEventListener('resize', window.gaEfbRefreshDrawerLayout);
  window.gaEfbRefreshDrawerLayout();
  window.addEventListener('load', function () {
    if (typeof window.__gaEfbReport !== 'function') return;
    var panel = document.querySelector('.map-side-drawer-panel');
    window.__gaEfbReport('info','font-ui-probe','local-artwork','',JSON.stringify({
      revision:'40201',
      namespace:document.body.namespaceURI, mutationObserver:typeof window.MutationObserver, pointerEvent:typeof window.PointerEvent,
      renderedSymbols:document.querySelectorAll('.ga-efb-symbol img').length, symbols:Object.keys(gaEfbSymbolArtwork).length,
      loadedSymbols:Object.keys(images).filter(function(k){return images[k].complete && images[k].naturalWidth > 0;}).length,
      theme:document.body.className, drawerWidth:panel && panel.getBoundingClientRect().width,
      drawerFont:panel && getComputedStyle(panel).fontFamily,
      cssMin:typeof CSS !== 'undefined' && CSS.supports && CSS.supports('width','min(94vw,420px)'),
      fontApi:!!document.fonts
    }));
  });
  // Preload once, locally, so the first profile render can use the same artwork.
  Object.keys(gaEfbSymbolArtwork).forEach(function(key){window.gaEfbSymbolImage(key);});
})();
