const test = require('node:test');
const assert = require('node:assert/strict');
const { portErrorMessage, notifyEfbPortError } = require('./tracker-efb-port-error');
test('occupied and Windows-denied ports receive distinct actionable messages', () => {
  assert.match(portErrorMessage({code:'EADDRINUSE'}, 49880), /bereits belegt/);
  assert.match(portErrorMessage({code:'EACCES'}, 49880), /Windows verweigert/);
  assert.match(portErrorMessage({code:'EACCES'}, 49880), /Tracker läuft weiter/);
  assert.equal(portErrorMessage({code:'OTHER'},49880),null);
});
test('Windows popup runs in a separate process, non-Windows only logs and failed popup preserves error', () => {
  let calls=0, unref=false, errorHandler; const logs=[];
  const options={platform:'win32',log:line=>logs.push(line),spawn:(exe,args,opts)=>{
    calls++;assert.equal(exe,'powershell.exe');assert.equal(opts.stdio,'ignore');
    const script=Buffer.from(args.at(-1),'base64').toString('utf16le');assert.match(script,/MessageBox/);assert.match(script,/49880/);
    return {on:(event,fn)=>{assert.equal(event,'error');errorHandler=fn;},unref:()=>{unref=true;}};
  }};
  assert.equal(notifyEfbPortError({code:'EACCES'},49880,options),true);
  assert.equal(calls,1);assert.equal(unref,true);errorHandler(new Error('test'));
  assert.match(logs.at(-1),/NOTICE_FAILED/);
  notifyEfbPortError({code:'EADDRINUSE'},49880,{...options,platform:'darwin'});assert.equal(calls,1);
  assert.equal(notifyEfbPortError({code:'OTHER'},49880,options),false);
});
