// Browser measurements with 6x CPU slowdown; not a substitute for a physical low-end phone.
const fs = require('node:fs');
module.exports = async function benchmark(command, evaluate, label) {
  if (!/^[a-z-]+$/.test(label)) throw new Error('Invalid benchmark label');
  await command('Emulation.setCPUThrottlingRate', { rate: 6 });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const measurements = [];
  for (const query of ['Samsung A05','Redmi 13C']) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      await evaluate('if(modal.open)modal.close();resetFilters();searchInput.value=' + JSON.stringify(query) + ';applyFilters()');
      const result = await evaluate(`(async()=>{
        const start=performance.now();
        document.querySelector('.brand-card').click();
        document.querySelector('[data-model]').click();
        document.querySelector('.modal-body').getBoundingClientRect();
        const synchronousMs=performance.now()-start;
        await new Promise(requestAnimationFrame);
        return {synchronousMs,untilFrameMs:performance.now()-start,modalNodes:modal.querySelectorAll('*').length,fileCards:document.querySelectorAll('.file-detail').length};
      })()`);
      samples.push(result);
    }
    const median = key => samples.map(s=>s[key]).sort((a,b)=>a-b)[2];
    measurements.push({ query, medianSynchronousMs: median('synchronousMs'), medianUntilFrameMs: median('untilFrameMs'), modalNodes:samples[4].modalNodes, fileCards:samples[4].fileCards });
  }
  const burst = await evaluate(`(async()=>{
    const input=document.querySelector('#firmwareSearch');
    const saved=renderVariants;let calls=0;
    renderVariants=(...args)=>{calls++;return saved(...args)};
    const start=performance.now();
    for(const value of ['V','V1','V14','V14.','V14.0','V14.0.5','V14.0.5.0','V14.0.5.0.T','V14.0.5.0.TGP','V14.0.5.0.TGPINXM']){input.value=value;input.dispatchEvent(new Event('input'));}
    const inputHandlerMs=performance.now()-start;
    await new Promise(resolve=>setTimeout(resolve,300));
    renderVariants=saved;
    return {inputHandlerMs,renderCalls:calls};
  })()`);
  await evaluate('modal.close()');
  await new Promise(resolve=>setTimeout(resolve,60));
  const closedModalNodes = await evaluate('modal.querySelectorAll("*").length');
  await command('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  const effects = await evaluate(`({runningAnimations:document.getAnimations().filter(a=>a.playState==='running').length,navBackdrop:getComputedStyle(document.querySelector('.nav')).backdropFilter,dialogBackdrop:getComputedStyle(modal,'::backdrop').backdropFilter})`);
  const fileCount = await evaluate('fileCatalog.length');
  const result = { cpuSlowdown:6, viewport:'390x844; effects also checked at desktop width', fileCount, measurements, burst, closedModalNodes, effects };
  fs.mkdirSync('.artifacts',{recursive:true});
  fs.writeFileSync('.artifacts/performance-' + label + '.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
};
