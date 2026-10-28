const { chromium } = require('playwright');
const { expect } = require('playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

(async () => {
  console.log('Browser smoke: starting local fixture server');
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((request, response) => {
    const relative = request.url === '/' ? 'tests/browser/smoke.html' : request.url.slice(1).split('?')[0];
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    try {
      const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      const content = fs.readFileSync(file);
      response.writeHead(200, { 'Content-Type': contentType }); response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  let browserServer;
  try {
    const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
    console.log('Browser smoke: launching '+(channel || 'chromium'));
    browserServer = await chromium.launchServer({ headless: true, timeout: 15000, ...(channel ? { channel } : {}) });
    browser = await chromium.connect(browserServer.wsEndpoint());
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(10000);
    await page.clock.install({ time: new Date('2026-10-28T09:00:00Z') });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    console.log('Browser smoke: fixture loaded');
    await page.getByRole('tab', {name:'Alex',exact:true}).waitFor();
    await page.locator('.card-board-card-title').filter({hasText:'Urgent long'}).waitFor();
    await expect(page.locator('.card-board-card')).toHaveCount(5);
    await page.getByRole('tab',{name:'Alex',exact:true}).click();
    await expect(page.locator('.card-board-card')).toHaveCount(3);
    assert.equal(await page.locator('.card-board-card').filter({hasText:'Sam job'}).count(),0);
    const color = await page.locator('.card-board-card[data-assignee=Alex] .card-board-card-content-area').first().evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(color,'rgb(195, 220, 250)');
    await page.evaluate(()=>{
      const changed=structuredClone(testSettings); changed.data.globalSettings.people[0].color='#112233';
      testApp.ports.interopToElm.send({tag:'settingsUpdated',data:changed});
    });
    await page.waitForFunction(()=>[...document.querySelectorAll('.card-board-card[data-assignee=Alex] .card-board-card-title')]
      .every(el=>getComputedStyle(el).color==='rgb(255, 255, 255)'));
    await page.evaluate(()=>testApp.ports.interopToElm.send({tag:'settingsUpdated',data:testSettings}));
    const border = await page.locator('.card-board-card').filter({hasText:'Urgent long'}).locator('.card-board-card-highlight-area').getAttribute('class');
    assert.match(border,/important/);
    assert.equal(await page.locator('.card-board-card').filter({hasText:'Urgent long'}).locator('.card-board-card-highlight-area').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(219, 150, 0)');
    await page.getByRole('tab',{name:'All people',exact:true}).click();
    await page.getByRole('button',{name:'Add card to Todo',exact:true}).click();
    await page.waitForFunction(()=>outbound.some(message=>message.tag==='createCard'));
    const urgentCard=page.locator('.card-board-card').filter({hasText:'Urgent long'});
    await urgentCard.getByRole('button',{name:'Assign person and colour'}).click();
    await page.waitForFunction(()=>outbound.some(message=>message.tag==='assignCard'));
    await urgentCard.getByRole('button',{name:'Edit estimate and urgency'}).click();
    await page.waitForFunction(()=>outbound.some(message=>message.tag==='editPlanning'));
    await urgentCard.dragTo(page.locator('.card-board-column-with-beacons').nth(1));
    await page.waitForFunction(()=>outbound.some(message=>message.tag==='moveCard' && message.data.columnIndex===1));
    await page.getByRole('button',{name:'Smart schedule view',exact:true}).click();
    await expect(page.locator('.card-board-schedule-day')).toHaveCount(5);
    await expect(page.locator('.card-board-schedule-slot.is-late')).toHaveCount(2);
    assert.equal(await page.locator('.card-board-schedule-day[aria-label="2026-10-28"]').locator('.card-board-schedule-slot').count(),2);
    await page.getByRole('heading',{name:'Needs estimate (1)',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Needs assignee (1)',exact:true}).waitFor();
    await page.getByRole('tab',{name:'Sam',exact:true}).click();
    await expect(page.locator('.card-board-schedule-slot')).toHaveCount(1);
    await page.getByRole('tab',{name:'All people',exact:true}).click();
    const screenshot = path.join(root,'elm-stuff','schedule-smoke.png');
    await page.screenshot({path:screenshot,fullPage:true});
    await page.getByRole('button',{name:'Next week',exact:true}).click();
    await expect(page.locator('.card-board-schedule-day').first()).toHaveAttribute('aria-label','2026-11-02');
    await page.getByRole('button',{name:'Previous week',exact:true}).click();
    await page.setViewportSize({width:480,height:850});
    assert.equal(await page.locator('.card-board-schedule-day').count(),5);
    assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('Browser smoke passed: tabs, colours, deadline border, creation/assignment/planning ports, drag/drop, five-day schedule, late highlights, missing metadata, week navigation and narrow layout.');
    console.log('Screenshot: '+screenshot);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    if(browser)await browser.close();
    if(browserServer)await browserServer.kill();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
