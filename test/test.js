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
    fs = require('fs'),
    path = require('path'),
    superagent = require('superagent'),
    webdriver = require('selenium-webdriver');

var by = webdriver.By,
    Keys = webdriver.Key,
    until = webdriver.until;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Application life cycle test', function () {
    this.timeout(0);

    var chrome = require('selenium-webdriver/chrome');
    var server, browser = new chrome.Driver(), uploadedImageUrl;
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

    var LOCATION = 'test';
    var TIMEOUT = parseInt(process.env.TIMEOUT, 10) || 30000;
    var app;
    var email, token;

    function waitForUrl(url) {
        return browser.wait(function () {
            return browser.getCurrentUrl().then(function (currentUrl) {
                return currentUrl === url;
            });
        }, TIMEOUT);
    }

    xit('build app', function () {
        execSync('cloudron build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('install app', function () {
        execSync('cloudron install --new --wait --location ' + LOCATION, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('can get app information', function () {
        var inspect = JSON.parse(execSync('cloudron inspect'));

        app = inspect.apps.filter(function (a) { return a.location === LOCATION; })[0];

        expect(app).to.be.an('object');
    });

    it('backup app', function () {
        execSync('cloudron backup create --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('restore app', function () {
        execSync('cloudron restore --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('can restart app', function (done) {
        execSync('cloudron restart --wait --app ' + app.id);
        done();
    });

    it('move to different location', function () {
        execSync('cloudron configure --wait --location ' + LOCATION + '2 --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION + '2'; })[0];
        expect(app).to.be.an('object');
    });

    it('uninstall app', function () {
        execSync('cloudron uninstall --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    // test update
    it('can install app', function () {
        execSync('cloudron install --new --wait --appstore-id ' + app.manifest.id + ' --location ' + LOCATION, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION; })[0];
        expect(app).to.be.an('object');
    });
    it('can update', function () {
        execSync('cloudron install --wait --app ' + LOCATION, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('uninstall app', function () {
        execSync('cloudron uninstall --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });
});
