const path = require('path');
const { AdaptiveComponentRegistration } = require('botbuilder-dialogs-adaptive');
const { AdaptiveTestComponentRegistration, TestUtils } = require('../lib');
const { ComponentRegistration } = require('botbuilder-core');
const { ResourceExplorer } = require('botbuilder-dialogs-declarative');
const { mochaExt } = require('botbuilder-test-utils');

describe('SettingsStateTests', function () {
    this.timeout(10000);

    ComponentRegistration.add(new AdaptiveComponentRegistration());
    ComponentRegistration.add(new AdaptiveTestComponentRegistration());

    const resourceExplorer = new ResourceExplorer().addFolder(
        path.join(__dirname, 'resources/SettingsStateTests'),
        true,
        false
    );

    mochaExt.withEnvironment({
        MicrosoftAppId: 'MICROSOFT_APP_ID',
        MicrosoftAppPassword: 'MICROSOFT_APP_PASSWORD',
        ApplicationInsightsInstrumentationKey: '00000000-0000-0000-0000-000000000000',
    });

    it('SettingsTest', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'SettingsStateTests_SettingsTest');
    });

    it('TestTurnStateAcrossBoundaries', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'SettingsStateTests_TestTurnStateAcrossBoundaries');
    });
});
