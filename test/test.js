#!/usr/bin/env node

/* jslint node:true */
/* global it:false */
/* global xit:false */
/* global describe:false */
/* global before:false */
/* global after:false */

'use strict';

require('chromedriver');

var execSync = require('child_process').execSync,
    expect = require('expect.js'),
    path = require('path');

var by = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until,
    Builder = require('selenium-webdriver').Builder;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Application life cycle test', function () {
    this.timeout(0);

    var server, browser = new Builder().forBrowser('chrome').build();
    var username = process.env.USERNAME, password = process.env.PASSWORD;

    before(function (done) {
        var seleniumJar= require('selenium-server-standalone-jar');
        var SeleniumServer = require('selenium-webdriver/remote').SeleniumServer;
        server = new SeleniumServer(seleniumJar.path, { port: 4444 });
        server.start();

        done();
    });

    after(function (done) {
        browser.quit();
        server.stop();
        done();
    });

    var EXEC_ARGS = { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' };
    var LOCATION = 'test';
    var TIMEOUT = parseInt(process.env.TIMEOUT, 10) || 30000;
    var app;

    function checkRegistration(mode, done) {
        browser.get('https://' + app.fqdn).then(function () {
            return browser.sleep(2000);
        }).then(function () {
            if (mode === 'none') {
                return browser.wait(until.elementLocated(by.xpath('//button[contains(text(), "is not accepting new members")]')), TIMEOUT);
            } else if (mode === 'open') {
                return browser.wait(until.elementLocated(by.xpath('//button[contains(text(), "Sign up")]')), TIMEOUT);
            }
        }).then(function () {
            done();
        });
    }

    function login(username, password, done) {
        browser.get('https://' + app.fqdn + '/about').then(function () { // there is also separate login page at /users/sign_in
            return browser.wait(until.elementLocated(by.xpath('//button[contains(text(), "Log in")]')), TIMEOUT);
        }).then(function () {
            return browser.findElement(by.id('login_user_email')).sendKeys(username);
        }).then(function () {
            return browser.findElement(by.id('login_user_password')).sendKeys(password);
        }).then(function () {
            return browser.findElement(by.xpath('//button[contains(text(), "Log in")]')).click();
        }).then(function () {
            return browser.sleep(3000); // can be wizard or timeline at this point
        }).then(function () {
            return done();
        });
    }

    function skipTutorial(done) {
        browser.findElement(by.xpath('//span[contains(text(), "Let\'s go")]')).click().then(function () {
            return browser.sleep(2000);
        }).then(function () {
            return browser.findElement(by.xpath('//span[contains(text(), "Next")]')).click();
        }).then(function () {
            return browser.sleep(2000);
        }).then(function () {
            return browser.findElement(by.xpath('//span[contains(text(), "Finish tutorial!")]')).click();
        }).then(function () {
            return browser.sleep(3000);
        }).then(function () {
            return browser.findElement(by.xpath('//a/span[contains(text(), "the public timeline")]')).click();
        }).then(function () {
            return browser.sleep(3000);
        }).then(function () {
            done();
        });
    }

    function checkTimeline(done) {
        browser.get('https://' + app.fqdn + '/web/timelines/home').then(function () {
            return browser.wait(until.elementLocated(by.xpath('//span[contains(text(), "Your home timeline is empty")]')), TIMEOUT);
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

    it('move to different location', function () { execSync('cloudron configure --location ' + LOCATION + '2 --app ' + app.id, EXEC_ARGS); });
    it('can get app information', getAppInfo);

    it('can LDAP login', login.bind(null, username, password));
    it('can see timeline', checkTimeline);

    it('uninstall app', function () { execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS); });

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
        return browser.wait(until.elementLocated(by.xpath('//span[contains(text(), "Waiting for e-mail confirmation to be completed")]')), TIMEOUT);
    });

    it('uninstall app (no sso)', function () { execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS); });

    // test update
    it('can install app', function () { execSync('cloudron install --appstore-id ' + app.manifest.id + ' --location ' + LOCATION, EXEC_ARGS); });
    it('can get app information', getAppInfo);
    it('can LDAP login', login.bind(null, username, password));
    it('can update', function () { execSync('cloudron update --app ' + LOCATION, EXEC_ARGS); });
    it('can LDAP login', login.bind(null, username, password));

    it('uninstall app', function () { execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS); });
});
