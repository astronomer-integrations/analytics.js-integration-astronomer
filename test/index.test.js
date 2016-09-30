
var Analytics = require('@astronomerio/analytics.js-core').constructor;
var assert = require('assert');
var cookie = require('cookie');
var integration = require('@astronomerio/analytics.js-integration');
var json = require('json');
var protocol = require('@segment/protocol');
var sandbox = require('@segment/clear-env');
var spy = require('@segment/spy');
var store = require('@segment/store');
var tester = require('@segment/analytics.js-integration-tester');
var type = require('component-type');
var Astronomer = require('../lib/');

describe('Astronomer.io', function() {
  var astronomer;
  var analytics;
  var options = {
    apiKey: 'oq0vdlg7yi'
  };

  before(function() {
    // Just to make sure that `cookie()`
    // doesn't throw URIError we add a cookie
    // that will cause `decodeURIComponent()` to throw.
    document.cookie = 'bad=%';
  });

  beforeEach(function() {
    protocol.reset();
    analytics = new Analytics();
    astronomer = new Astronomer(options);
    analytics.use(Astronomer);
    analytics.use(tester);
    analytics.add(segment);
    analytics.assert(Segment.global === window);
    resetCookies();
  });

  afterEach(function() {
    analytics.restore();
    analytics.reset();
    resetCookies();
    segment.reset();
    sandbox();
  });

  function resetCookies() {
    store('s:context.referrer', null);
    cookie('s:context.referrer', null, { maxage: -1, path: '/' });
  }

  it('should have the right settings', function() {
    analytics.compare(Segment, integration('Segment.io')
      .option('apiKey', ''));
  });

  it('should always be turned on', function(done) {
    var Analytics = analytics.constructor;
    var ajs = new Analytics();
    ajs.use(Astronomer);
    ajs.initialize({ 'Segment.io': options });
    ajs.ready(function() {
      var segment = ajs._integrations['Segment.io'];
      segment.ontrack = spy();
      ajs.track('event', {}, { All: false });
      assert(segment.ontrack.called);
      done();
    });
  });

  describe('Segment.storage()', function() {
    it('should return cookie() when the protocol isnt file://', function() {
      analytics.assert(Astronomer.storage(), cookie);
    });

    it('should return store() when the protocol is file://', function() {
      analytics.assert(Astronomer.storage(), cookie);
      protocol('file:');
      analytics.assert(Astronomer.storage(), store);
    });

    it('should return store() when the protocol is chrome-extension://', function() {
      analytics.assert(Astronomer.storage(), cookie);
      protocol('chrome-extension:');
      analytics.assert(Astronomer.storage(), store);
    });
  });

  describe('before loading', function() {
    beforeEach(function() {
      analytics.stub(astronomer, 'load');
    });

    describe('#normalize', function() {
      var object;

      beforeEach(function() {
        astronomer.cookie('s:context.referrer', null);
        analytics.initialize();
        object = {};
      });

      it('should add .anonymousId', function() {
        analytics.user().anonymousId('anon-id');
        astronomer.normalize(object);
        analytics.assert(object.anonymousId === 'anon-id');
      });

      it('should add .sentAt', function() {
        astronomer.normalize(object);
        analytics.assert(object.sentAt);
        analytics.assert(type(object.sentAt) === 'date');
      });

      it('should add .userId', function() {
        analytics.user().id('user-id');
        astronomer.normalize(object);
        analytics.assert(object.userId === 'user-id');
      });

      it('should not replace the .userId', function() {
        analytics.user().id('user-id');
        object.userId = 'existing-id';
        astronomer.normalize(object);
        analytics.assert(object.userId === 'existing-id');
      });

      it('should always add .anonymousId even if .userId is given', function() {
        var object = { userId: 'baz' };
        astronomer.normalize(object);
        analytics.assert(object.anonymousId.length === 36);
      });

      it('should add .context', function() {
        astronomer.normalize(object);
        analytics.assert(object.context);
      });

      it('should not rewrite context if provided', function() {
        var ctx = {};
        var object = { context: ctx };
        astronomer.normalize(object);
        analytics.assert(object.context === ctx);
      });

      it('should copy .options to .context', function() {
        var opts = {};
        var object = { options: opts };
        astronomer.normalize(object);
        analytics.assert(object.context === opts);
        analytics.assert(object.options == null);
      });

      it('should add .writeKey', function() {
        astronomer.normalize(object);
        analytics.assert(object.writeKey === astronomer.options.apiKey);
      });

      it('should add .messageId', function() {
        astronomer.normalize(object);
        analytics.assert(object.messageId.length === 36);
      });

      it('should add .library', function() {
        astronomer.normalize(object);
        analytics.assert(object.context.library);
        analytics.assert(object.context.library.name === 'analytics.js');
        analytics.assert(object.context.library.version === analytics.VERSION);
      });

      it('should allow override of .library', function() {
        var ctx = {
          library: {
            name: 'analytics-wordpress',
            version: '1.0.3'
          }
        };
        var object = { context: ctx };
        astronomer.normalize(object);
        analytics.assert(object.context.library);
        analytics.assert(object.context.library.name === 'analytics-wordpress');
        analytics.assert(object.context.library.version === '1.0.3');
      });

      it('should add .userAgent', function() {
        astronomer.normalize(object);
        analytics.assert(object.context.userAgent === navigator.userAgent);
      });

      it('should add .campaign', function() {
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.search = '?utm_source=source&utm_medium=medium&utm_term=term&utm_content=content&utm_campaign=name';
        Astronomer.global.location.hostname = 'localhost';
        astronomer.normalize(object);
        analytics.assert(object);
        analytics.assert(object.context);
        analytics.assert(object.context.campaign);
        analytics.assert(object.context.campaign.source === 'source');
        analytics.assert(object.context.campaign.medium === 'medium');
        analytics.assert(object.context.campaign.term === 'term');
        analytics.assert(object.context.campaign.content === 'content');
        analytics.assert(object.context.campaign.name === 'name');
        Astronomer.global = window;
      });

      it('should add .referrer.id and .referrer.type', function() {
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.search = '?utm_source=source&urid=medium';
        Astronomer.global.location.hostname = 'localhost';
        astronomer.normalize(object);
        analytics.assert(object);
        analytics.assert(object.context);
        analytics.assert(object.context.referrer);
        analytics.assert(object.context.referrer.id === 'medium');
        analytics.assert(object.context.referrer.type === 'millennial-media');
        Astronomer.global = window;
      });

      it('should add .referrer.id and .referrer.type from cookie', function() {
        astronomer.cookie('s:context.referrer', '{"id":"baz","type":"millennial-media"}');
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.search = '?utm_source=source';
        Astronomer.global.location.hostname = 'localhost';
        astronomer.normalize(object);
        analytics.assert(object);
        analytics.assert(object.context);
        analytics.assert(object.context.referrer);
        analytics.assert(object.context.referrer.id === 'baz');
        analytics.assert(object.context.referrer.type === 'millennial-media');
        Astronomer.global = window;
      });

      it('should add .referrer.id and .referrer.type from cookie when no query is given', function() {
        astronomer.cookie('s:context.referrer', '{"id":"medium","type":"millennial-media"}');
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.search = '';
        Astronomer.global.location.hostname = 'localhost';
        astronomer.normalize(object);
        analytics.assert(object);
        analytics.assert(object.context);
        analytics.assert(object.context.referrer);
        analytics.assert(object.context.referrer.id === 'medium');
        analytics.assert(object.context.referrer.type === 'millennial-media');
        Astronomer.global = window;
      });
    });
  });

  describe('after loading', function() {
    beforeEach(function(done) {
      analytics.once('ready', done);
      analytics.initialize();
      analytics.page();
    });

    describe('#page', function() {
      beforeEach(function() {
        analytics.stub(astronomer, 'send');
      });

      it('should send section, name and properties', function() {
        analytics.page('section', 'name', { property: true }, { opt: true });
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/p');
        analytics.assert(args[1].name === 'name');
        analytics.assert(args[1].category === 'section');
        analytics.assert(args[1].properties.property === true);
        analytics.assert(args[1].context.opt === true);
        analytics.assert(args[1].timestamp);
      });
    });

    describe('#identify', function() {
      beforeEach(function() {
        analytics.stub(astronomer, 'send');
      });

      it('should send an id and traits', function() {
        analytics.identify('id', { trait: true }, { opt: true });
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/i');
        analytics.assert(args[1].userId === 'id');
        analytics.assert(args[1].traits.trait === true);
        analytics.assert(args[1].context.opt === true);
        analytics.assert(args[1].timestamp);
      });
    });

    describe('#track', function() {
      beforeEach(function() {
        analytics.stub(astronomer, 'send');
      });

      it('should send an event and properties', function() {
        analytics.track('event', { prop: true }, { opt: true });
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/t');
        analytics.assert(args[1].event === 'event');
        analytics.assert(args[1].context.opt === true);
        analytics.assert(args[1].properties.prop === true);
        analytics.assert(args[1].traits == null);
        analytics.assert(args[1].timestamp);
      });
    });

    describe('#group', function() {
      beforeEach(function() {
        analytics.stub(astronomer, 'send');
      });

      it('should send groupId and traits', function() {
        analytics.group('id', { trait: true }, { opt: true });
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/g');
        analytics.assert(args[1].groupId === 'id');
        analytics.assert(args[1].context.opt === true);
        analytics.assert(args[1].traits.trait === true);
        analytics.assert(args[1].timestamp);
      });
    });

    describe('#alias', function() {
      beforeEach(function() {
        analytics.stub(astronomer, 'send');
      });

      it('should send .userId and .previousId', function() {
        analytics.alias('to', 'from');
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/a');
        analytics.assert(args[1].previousId === 'from');
        analytics.assert(args[1].userId === 'to');
        analytics.assert(args[1].timestamp);
      });

      it('should fallback to user.anonymousId if .previousId is omitted', function() {
        analytics.user().anonymousId('anon-id');
        analytics.alias('to');
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/a');
        analytics.assert(args[1].previousId === 'anon-id');
        analytics.assert(args[1].userId === 'to');
        analytics.assert(args[1].timestamp);
      });

      it('should fallback to user.anonymousId if .previousId and user.id are falsey', function() {
        analytics.alias('to');
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/a');
        analytics.assert(args[1].previousId);
        analytics.assert(args[1].previousId.length === 36);
        analytics.assert(args[1].userId === 'to');
      });

      it('should rename `.from` and `.to` to `.previousId` and `.userId`', function() {
        analytics.alias('user-id', 'previous-id');
        var args = astronomer.send.args[0];
        analytics.assert(args[0] === '/a');
        analytics.assert(args[1].previousId === 'previous-id');
        analytics.assert(args[1].userId === 'user-id');
        analytics.assert(args[1].from == null);
        analytics.assert(args[1].to == null);
      });
    });

    describe('#send', function() {
      beforeEach(function() {
        analytics.spy(astronomer, 'session');
      });

      it('should use http: protocol when http:', function(done) {
        protocol('http:');
        astronomer.send('/i', { userId: 'id' }, function(err, res) {
          if (err) return done(err);
          assert.equal('http://api.astronomer.io/v1/i', res.url);
          done();
        });
      });

      it('should use https: protocol when https:', function(done) {
        protocol('https:');
        astronomer.send('/i', { userId: 'id' }, function(err, res) {
          if (err) return done(err);
          assert.equal('https://api.astronomer.io/v1/i', res.url);
          done();
        });
      });

      it('should use https: protocol when file:', function(done) {
        protocol('file:');
        astronomer.send('/i', { userId: 'id' }, function(err, res) {
          if (err) return done(err);
          assert.equal('https://api.astronomer.io/v1/i', res.url);
          done();
        });
      });

      it('should use https: protocol when chrome-extension:', function(done) {
        protocol('chrome-extension:');
        astronomer.send('/i', { userId: 'id' }, function(err, res) {
          if (err) return done(err);
          assert.equal('https://api.astronomer.io/v1/i', res.url);
          done();
        });
      });

      describe('/g', ensure('/g', { groupId: 'gid', userId: 'uid' }));
      describe('/p', ensure('/p', { userId: 'id', name: 'page', properties: {} }));
      describe('/a', ensure('/a', { userId: 'id', from: 'b', to: 'a' }));
      describe('/t', ensure('/t', { userId: 'id', event: 'my-event', properties: {} }));
      describe('/i', ensure('/i', { userId: 'id' }));
    });

    describe('#cookie', function() {
      beforeEach(function() {
        astronomer.cookie('foo', null);
      });

      it('should persist the cookie even when the hostname is "dev"', function() {
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.href = 'https://dev:300/path';
        analytics.assert(astronomer.cookie('foo') == null);
        astronomer.cookie('foo', 'bar');
        analytics.assert(astronomer.cookie('foo') === 'bar');
        Astronomer.global = window;
      });

      it('should persist the cookie even when the hostname is "127.0.0.1"', function() {
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.href = 'http://127.0.0.1:3000/';
        analytics.assert(astronomer.cookie('foo') == null);
        astronomer.cookie('foo', 'bar');
        analytics.assert(astronomer.cookie('foo') === 'bar');
        Astronomer.global = window;
      });

      it('should persist the cookie even when the hostname is "app.herokuapp.com"', function() {
        Astronomer.global = { navigator: {}, location: {} };
        Astronomer.global.location.href = 'https://app.herokuapp.com/about';
        Astronomer.global.location.hostname = 'app.herokuapp.com';
        analytics.assert(astronomer.cookie('foo') == null);
        astronomer.cookie('foo', 'bar');
        analytics.assert(astronomer.cookie('foo') === 'bar');
        Astronomer.global = window;
      });
    });

    // ensure the given endpoint succeeds with fixture.
    function ensure(endpoint, fixture) {
      return function() {
        it('should succeed', function(done) {
          astronomer.send(endpoint, fixture, function(err, req) {
            if (err) return done(err);
            analytics.assert(json.parse(req.responseText).success);
            done();
          });
        });
      };
    }
  });
});
