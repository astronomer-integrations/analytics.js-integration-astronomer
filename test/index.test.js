var Analytics = require('@astronomerio/analytics.js-core').constructor;
var Astronomer = require('../lib/');
var integration = require('@astronomerio/analytics.js-integration');
var tester = require('@segment/analytics.js-integration-tester');
var sandbox = require('@segment/clear-env');

describe('Astronomer.io', function() {
  var astronomer;
  var analytics;
  var options = {
    apiKey: 'oq0vdlg7yi'
  };

  beforeEach(function() {
    analytics = new Analytics();
    astronomer = new Astronomer(options);
    analytics.use(Astronomer);
    analytics.use(tester);
    analytics.add(astronomer);
  });

  afterEach(function() {
    analytics.restore();
    analytics.reset();
    astronomer.reset();
    sandbox();
  });


  it('should have the correct settings', function() {
    analytics.compare(Astronomer, integration('astronomer'));
  });
});
