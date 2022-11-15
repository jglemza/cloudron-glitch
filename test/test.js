#!/usr/bin/env node

/* jshint esversion: 8 */
/* global describe */
/* global before */
/* global after */
/* global it */
/* global xit */

'use strict';

require('chromedriver');

const execSync = require('child_process').execSync,
    expect = require('expect.js'),
    path = require('path'),
    { Builder, By, until } = require('selenium-webdriver'),
    { Options } = require('selenium-webdriver/chrome');

if (!process.env.USERNAME || !process.env.PASSWORD) {
    console.log('USERNAME and PASSWORD env vars need to be set');
    process.exit(1);
}

describe('Application life cycle test', function () {
    this.timeout(0);

    const LOCATION = 'test';
    const TEST_TIMEOUT = parseInt(process.env.TIMEOUT) || 10000;
    const EXEC_ARGS = { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' };

    let browser, app;
    let username = process.env.USERNAME;
    let password = process.env.PASSWORD;
    let manifest = require('../CloudronManifest.json');

    before(function () {
        browser = new Builder().forBrowser('chrome').setChromeOptions(new Options().windowSize({ width: 1280, height: 1024 })).build();
    });

    after(function () {
        browser.quit();
    });

    async function exists(selector) {
        await browser.wait(until.elementLocated(selector), TEST_TIMEOUT);
    }

    async function visible(selector) {
        await exists(selector);
        await browser.wait(until.elementIsVisible(browser.findElement(selector)), TEST_TIMEOUT);
    }

    async function checkRegistration(mode) {
       if (mode === 'none') {
            await browser.get('https://' + app.fqdn);
            await browser.sleep(2000);
            await browser.findElement(By.xpath('//button/span[contains(text(), "Create account")]')).click();
            await visible(By.xpath('//span[contains(text()[2], "is currently not possible")]'));
        } else if (mode === 'open') {
            await browser.get('https://' + app.fqdn + '/auth/sign_up');
            await visible(By.xpath('//button[contains(text(), "Sign up")]'));
        }
    }

    async function login(username, password) {
        await browser.get('https://' + app.fqdn + '/auth/sign_in'); // there is also separate login page at /users/sign_in
        await browser.wait(until.elementLocated(By.xpath('//button[contains(text(), "Log in")]')), TEST_TIMEOUT);
        await browser.findElement(By.id('user_email')).sendKeys(username);
        await browser.findElement(By.id('user_password')).sendKeys(password);
        await browser.findElement(By.xpath('//button[contains(text(), "Log in")]')).click();
        await browser.sleep(3000); // can be wizard or timeline at this point
    }

    async function logout() {
        await browser.get('https://' + app.fqdn + '/settings/preferences/appearance'); // there is also separate login page at /users/sign_in
        await browser.wait(until.elementLocated(By.id('logout')), TEST_TIMEOUT);
        await browser.findElement(By.id('logout')).click();
        await browser.wait(until.elementLocated(By.id('user_email')), TEST_TIMEOUT);
    }

    async function skipTutorial() {
        await browser.get('https://' + app.fqdn + '/web/start');
        await browser.wait(until.elementLocated(By.xpath('//button/span[text() = "Done"]')), TEST_TIMEOUT);
        await browser.findElement(By.xpath('//button/span[text() = "Done"]')).click();
        await browser.sleep(5000); // can be wizard or timeline at this point
        await browser.wait(until.elementLocated(By.xpath('//span[text() = "See some suggestions"]')), TEST_TIMEOUT);
        await browser.sleep(5000);
    }

    async function checkTimeline() {
        await browser.get('https://' + app.fqdn + '/home');
        await browser.sleep(2000);
        await browser.wait(until.elementLocated(By.xpath('//span[text() = "See some suggestions"]')), TEST_TIMEOUT);
    }

    function getAppInfo() {
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION || a.location === LOCATION + '2'; })[0];
        expect(app).to.be.an('object');
    }

    xit('build app', function () { execSync('cloudron build', EXEC_ARGS); });
    it('install app', function () { execSync('cloudron install --location ' + LOCATION, EXEC_ARGS); });

    it('can get app information', getAppInfo);
    it('registration is disabled', checkRegistration.bind(null, 'none'));
    it('can LDAP login', login.bind(null, username, password));
    it('can skip tutorial', skipTutorial);
    it('can see timeline', checkTimeline);
    it('can logout', logout);

    it('backup app', function () { execSync('cloudron backup create --app ' + app.id, EXEC_ARGS); });
    it('restore app', function () {
        const backups = JSON.parse(execSync('cloudron backup list --raw'));
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
        execSync('cloudron install --location ' + LOCATION, EXEC_ARGS);
        getAppInfo();
        execSync(`cloudron restore --backup ${backups[0].id} --app ${app.id}`, EXEC_ARGS);
    });

    it('can LDAP login', login.bind(null, username, password));
    it('can see timeline', checkTimeline);

    it('can restart app', function () { execSync('cloudron restart --app ' + app.id, EXEC_ARGS); });
    it('can see timeline', checkTimeline);

    it('move to different location', async function () {
        await browser.get('about:blank');
        execSync('cloudron configure --location ' + LOCATION + '2 --app ' + app.id, EXEC_ARGS);
    });
    it('can get app information', getAppInfo);

    it('can LDAP login', login.bind(null, username, password));
    it('can see timeline', checkTimeline);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });

    // No SSO
    it('install app (no sso)', function () { execSync('cloudron install --no-sso --location ' + LOCATION, EXEC_ARGS); });
    it('can get app information', getAppInfo);

    it('has registration open', checkRegistration.bind(null, 'open'));
    let testPassword;
    it('create a user with CLI', function () {
        let output = execSync('cloudron exec --app ' + LOCATION + ' -- bin/tootctl accounts create test --email=test@cloudron.io', { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
        console.log(output);
        testPassword = output.slice(output.indexOf('New password: ') + 'New password: '.length).trim();
        console.log(testPassword);
    });

    it('can login (no sso)', async function () {
        await login('test@cloudron.io', testPassword);
    });

    it('shows confirmation page', function () {
        return browser.wait(until.elementLocated(By.xpath('//div[contains(text(), "Waiting for e-mail confirmation to be completed")]')), TEST_TIMEOUT);
    });

    it('uninstall app (no sso)', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });

    // test update
    it('can install app', function () { execSync('cloudron install --appstore-id ' + manifest.id + ' --location ' + LOCATION, EXEC_ARGS); });
    it('can get app information', getAppInfo);
    it('can LDAP login', login.bind(null, username, password));
    it('can logout', logout);

    it('can update', async function () {
        await browser.get('about:blank');
        execSync('cloudron update --app ' + LOCATION, EXEC_ARGS);
    });

    it('can LDAP login', login.bind(null, username, password));

    it('uninstall app', function () { execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS); });
});
