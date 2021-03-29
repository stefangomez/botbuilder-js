const assert = require('assert');
const path = require('path');
const { AdaptiveComponentRegistration } = require('botbuilder-dialogs-adaptive');
const { ComponentRegistration } = require('botbuilder-core');
const { LuisAdaptiveRecognizer } = require('botbuilder-ai');
const { ResourceExplorer } = require('botbuilder-dialogs-declarative');
const { mochaExt } = require('botbuilder-test-utils');

const {
    AdaptiveTestComponentRegistration,
    MockLuisLoader,
    MockLuisRecognizer,
    TestUtils,
    useMockLuisSettings,
} = require('../lib');

describe('TestScriptTests', function () {
    this.timeout(5000);

    ComponentRegistration.add(new AdaptiveComponentRegistration());
    ComponentRegistration.add(new AdaptiveTestComponentRegistration());

    const resourceExplorer = new ResourceExplorer().addFolder(
        path.join(__dirname, 'resources/TestScriptTests'),
        true,
        false
    );

    it('AssertReply_Assertions', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReply_Assertions');
    });

    it('AssertReply_AssertCondition', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertCondition');
    });

    it('AssertReply_Assertions_Failed', async () => {
        try {
            await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReply_Assertions_Failed');
        } catch (error) {
            assert(error.message.includes('"text":"hi User1"'), `assertion should have failed.`);
        }
    });

    it('AssertReply_Exact', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReply_Exact');
    });

    it('AssertReply_ExactInvalid', async () => {
        assert.rejects(async () => {
            await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReply_ExactInvalid');
        });
    });

    it('AssertReply_Invalid', async () => {
        assert.rejects(async () => {
            await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReply_Invalid');
        });
    });

    it('AssertReply_User', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReply_User');
    });

    it('AssertReplyOneOf_Assertions', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReplyOneOf_Assertions');
    });

    it('AssertReplyOneOf_Exact', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReplyOneOf_Exact');
    });

    it('AssertReplyOneOf_User', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReplyOneOf_User');
    });

    it('AssertReplyOneOf', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_AssertReplyOneOf');
    });

    it('CustomEvent', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_CustomEvent');
    });

    it('HttpRequestLuisMock', async () => {
        const resourceDir = path.join(__dirname, 'resources/TestScriptTests/LuisMock');
        const config = useMockLuisSettings(resourceDir);
        const explorer = new ResourceExplorer().addFolder(
            path.join(__dirname, 'resources/TestScriptTests'),
            true,
            false
        );
        explorer.registerType(LuisAdaptiveRecognizer.$kind, MockLuisRecognizer, new MockLuisLoader(explorer, config));
        await TestUtils.runTestScript(explorer, 'TestScriptTests_HttpRequestLuisMock', undefined, config);
    });

    it('HttpRequestMock', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_HttpRequestMock');
    });

    it('HttpRequestQnAMakerRecognizerMock', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_HttpRequestQnAMakerRecognizerMock');
    });

    it('HttpRequestQnAMakerDialogMock', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_HttpRequestQnAMakerDialogMock');
    });

    it('OAuthInputLG', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_OAuthInputLG');
    });

    it('OAuthInputMockProperties', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_OAuthInputMockProperties');
    });

    it('OAuthInputRetries_WithNullMessageText', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_OAuthInputRetries_WithNullMessageText');
    });

    describe('overridden file', function () {
        mochaExt.withEnvironment({
            file: 'set settings.file',
        });

        it('PropertyMock', async () => {
            await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_PropertyMock');
        });
    });

    it('SettingMock', async () => {
        const configuration = {
            file: 'set settings.file',
            fileoverwrite: 'this is overwritten',
        };
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_SettingMock', undefined, configuration);
    });

    it('UserActivity', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_UserActivity');
    });

    it('UserConversationUpdate', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_UserConversationUpdate');
    });

    it('UserTokenMock', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_UserTokenMock');
    });

    it('UserTyping', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'TestScriptTests_UserTyping');
    });
});
