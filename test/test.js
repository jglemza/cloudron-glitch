#!/usr/bin/env node

/* jshint esversion: 8 */
/* global describe */
/* global before */
/* global after */
/* global it */

'use strict';

require('chromedriver');

var execSync = require('child_process').execSync,
    expect = require('expect.js'),
    path = require('path'),
    fs = require('fs'),
    { Builder, By, Key, until } = require('selenium-webdriver'),
    { Options } = require('selenium-webdriver/chrome');

if (!process.env.USERNAME || !process.env.PASSWORD) {
    console.log('USERNAME and PASSWORD env vars need to be set');
    process.exit(1);
}

describe('Application life cycle test', function () {
    this.timeout(0);

    const LOCATION = 'test';
    const TEST_TIMEOUT = 10000;
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

    function checkRegistration(mode, done) {
        browser.get('https://' + app.fqdn).then(function () {
            return browser.sleep(2000);
        }).then(function () {
            if (mode === 'none') {
                return browser.wait(until.elementLocated(By.xpath('//button[contains(text(), "is not accepting new members")]')), TEST_TIMEOUT);
            } else if (mode === 'open') {
                return browser.wait(until.elementLocated(By.xpath('//button[contains(text(), "Sign up")]')), TEST_TIMEOUT);
            }
        }).then(function () {
            done();
        });
    }

    function login(username, password, done) {
        browser.get('https://' + app.fqdn + '/auth/sign_in').then(function () { // there is also separate login page at /users/sign_in
            return browser.wait(until.elementLocated(By.xpath('//button[contains(text(), "Log in")]')), TEST_TIMEOUT);
        }).then(function () {
            return browser.findElement(By.id('user_email')).sendKeys(username);
        }).then(function () {
            return browser.findElement(By.id('user_password')).sendKeys(password);
        }).then(function () {
            return browser.findElement(By.xpath('//button[contains(text(), "Log in")]')).click();
        }).then(function () {
            return browser.sleep(3000); // can be wizard or timeline at this point
        }).then(function () {
            return done();
        });
    }

    function logout(done) {
        browser.get('https://' + app.fqdn + '/settings/preferences/appearance').then(function () { // there is also separate login page at /users/sign_in
            return browser.wait(until.elementLocated(By.id('logout')), TEST_TIMEOUT);
        }).then(function () {
            return browser.findElement(By.id('logout')).click();
        }).then(function () {
            return browser.wait(until.elementLocated(By.id('user_email')), TEST_TIMEOUT);
        }).then(function () {
            return done();
        });
    }

    function skipTutorial(done) {
        browser.get('https://' + app.fqdn + '/web/start').then(function () {
            return browser.wait(until.elementLocated(By.xpath('//span[text() = "Done"]')), TEST_TIMEOUT);
        }).then(function () {
            return browser.findElement(By.xpath('//span[text() = "Done"]')).click();
        }).then(function () {
            return browser.sleep(3000); // can be wizard or timeline at this point
        }).then(function () {
            return browser.wait(until.elementLocated(By.xpath('//span[text() = "See some suggestions"]')), TEST_TIMEOUT);
        }).then(function () {
            done();
        });
    }

    function checkTimeline(done) {
        browser.get('https://' + app.fqdn + '/web/timelines/home').then(function () {
            return browser.wait(until.elementLocated(By.xpath('//span[text() = "See some suggestions"]')), TEST_TIMEOUT);
        }).then(function () {
            done();
        });
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

    it('backup app', function () { execSync('cloudron backup create --app ' + app.id, EXEC_ARGS); });
    it('restore app', function () { execSync('cloudron restore --app ' + app.id, EXEC_ARGS); });

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

    it('can login (no sso)', (done) => login('test@cloudron.io', testPassword, done));
    it('shows confirmation page', function () {
        return browser.wait(until.elementLocated(By.xpath('//span[contains(text(), "Waiting for e-mail confirmation to be completed")]')), TEST_TIMEOUT);
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
