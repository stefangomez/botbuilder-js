const { ok, strictEqual } = require('assert');
const {
    ActivityTypes,
    AutoSaveStateMiddleware,
    ConversationState,
    EndOfConversationCodes,
    InputHints,
    MemoryStorage,
    MessageFactory,
    SkillConversationReferenceKey,
    TestAdapter,
    UserState,
    useBotState,
} = require('botbuilder-core');
const {
    ComponentDialog,
    DialogReason,
    TextPrompt,
    WaterfallDialog,
    DialogManager,
    DialogTurnStatus,
    DialogEvents,
} = require('../');
const { AuthenticationConstants } = require('botframework-connector');
const { AdaptiveDialog, OnBeginDialog, EndTurn, SendActivity } = require('../../botbuilder-dialogs-adaptive/lib');

const FlowTestCase = {
    RootBotOnly: 'RootBotOnly',
    RootBotConsumingSkill: 'RootBotConsumingSkill',
    MiddleSkill: 'MiddleSkill',
    LeafSkill: 'LeafSkill',
};

class ClaimsIdentity {
    constructor(claims = [], isAuthenticated = true) {
        this.claims = claims;
        this.isAuthenticated = isAuthenticated;
    }
    /**
     * Returns a claim value (if its present)
     *
     * @param  {string} claimType The claim type to look for
     * @returns {string|null} The claim value or null if not found
     */
    getClaimValue(claimType) {
        const claim = this.claims.find((c) => c.type === claimType);
        return claim ? claim.value : null;
    }

    addClaim(claim) {
        this.claims.push(claim);
    }
}

const PARENT_BOT_ID = '00000000-0000-0000-0000-0000000000PARENT';
const SKILL_BOT_ID = '00000000-0000-0000-0000-00000000000SKILL';
let _eocSent;
let _dmTurnResult;

function createTestFlow(dialog, testCase = FlowTestCase.RootBotOnly, enabledTrace = false) {
    const conversationId = 'testFlowConversationId';
    const storage = new MemoryStorage();
    const convoState = new ConversationState(storage);
    const userState = new UserState(storage);

    const convRef = {
        channelId: 'test',
        serviceUrl: 'https://test.com',
        from: { id: 'user1', name: 'User1' },
        recipient: { id: 'bot', name: 'Bot' },
        conversation: {
            isGroup: false,
            conversationType: conversationId,
            id: conversationId,
        },
    };

    const dm = new DialogManager(dialog);
    dm.userState = userState;
    dm.conversationState = convoState;

    const adapter = new TestAdapter(
        async (context) => {
            if (testCase !== FlowTestCase.RootBotOnly) {
                // Create a skill ClaimsIdentity and put it in turnState so isSkillClaim() returns true.
                const claimsIdentity = new ClaimsIdentity();
                claimsIdentity.addClaim({ type: 'ver', value: '2.0' }); // AuthenticationConstants.VersionClaim
                claimsIdentity.addClaim({ type: 'aud', value: SKILL_BOT_ID }); // AuthenticationConstants.AudienceClaim
                claimsIdentity.addClaim({ type: 'azp', value: PARENT_BOT_ID }); // AuthenticationConstants.AuthorizedParty
                context.turnState.set(context.adapter.BotIdentityKey, claimsIdentity);

                if (testCase === FlowTestCase.RootBotConsumingSkill) {
                    // Simulate the SkillConversationReference with a channel OAuthScope stored in turnState.
                    // This emulates a response coming to a root bot through SkillHandler.
                    context.turnState.set(SkillConversationReferenceKey, {
                        oAuthScope: AuthenticationConstants.ToBotFromChannelTokenIssuer,
                    });
                }

                if (testCase === FlowTestCase.MiddleSkill) {
                    // Simulate the SkillConversationReference with a parent Bot ID stored in turnState.
                    // This emulates a response coming to a skill from another skill through SkillHandler.
                    context.turnState.set(SkillConversationReferenceKey, { oAuthScope: PARENT_BOT_ID });
                }
            }

            // Interceptor to capture the EoC activity if it was sent so we can assert it in the tests.
            context.onSendActivities(async (tc, activities, next) => {
                for (let idx = 0; idx < activities.length; idx++) {
                    if (activities[idx].type === ActivityTypes.EndOfConversation) {
                        _eocSent = activities[idx];
                        break;
                    }
                }
                return await next();
            });

            _dmTurnResult = await dm.onTurn(context);
        },
        convRef,
        enabledTrace
    );
    adapter.use(new AutoSaveStateMiddleware(userState, convoState));

    return adapter;
}

class SimpleComponentDialog extends ComponentDialog {
    constructor(id, property) {
        super(id || 'SimpleComponentDialog');
        this.TextPrompt = 'TextPrompt';
        this.WaterfallDialog = 'WaterfallDialog';
        this.addDialog(new TextPrompt(this.TextPrompt));
        this.addDialog(
            new WaterfallDialog(this.WaterfallDialog, [this.promptForName.bind(this), this.finalStep.bind(this)])
        );
        this.initialDialogId = this.WaterfallDialog;
        this.endReason;
    }

    async onEndDialog(context, instance, reason) {
        this.endReason = reason;
        return super.onEndDialog(context, instance, reason);
    }

    async promptForName(step) {
        return step.prompt(this.TextPrompt, {
            prompt: MessageFactory.text('Hello, what is your name?', undefined, InputHints.ExpectingInput),
            retryPrompt: MessageFactory.text('Hello, what is your name again?', undefined, InputHints.ExpectingInput),
        });
    }

    async finalStep(step) {
        await step.context.sendActivity(`Hello ${step.result}, nice to meet you!`);
        return step.endDialog(step.result);
    }
}

describe('DialogManager', function () {
    this.timeout(300);

    this.beforeEach(() => {
        _dmTurnResult = undefined;
    });

    describe('HandlesBotAndSkillsTestCases', () => {
        this.beforeEach(() => {
            _eocSent = undefined;
            _dmTurnResult = undefined;
        });

        async function handlesBotAndSkillsTestCases(testCase, shouldSendEoc) {
            const dialog = new SimpleComponentDialog();
            const testFlow = createTestFlow(dialog, testCase);
            await testFlow
                .send('Hi')
                .assertReply('Hello, what is your name?')
                .send('SomeName')
                .assertReply('Hello SomeName, nice to meet you!')
                .startTest();
            strictEqual(_dmTurnResult.turnResult.status, DialogTurnStatus.complete);

            strictEqual(dialog.endReason, DialogReason.endCalled);
            if (shouldSendEoc) {
                ok(_eocSent, 'Skills should send EndConversation to channel');
                strictEqual(_eocSent.type, ActivityTypes.EndOfConversation);
                strictEqual(_eocSent.code, EndOfConversationCodes.CompletedSuccessfully);
                strictEqual(_eocSent.value, 'SomeName');
            } else {
                strictEqual(undefined, _eocSent, 'Root bot should not send EndConversation to channel');
            }
        }

        it('rootBotOnly, no sent EoC', async () => {
            await handlesBotAndSkillsTestCases(FlowTestCase.RootBotOnly, false);
        });

        it('rootBotConsumingSkill, no sent EoC', async () => {
            await handlesBotAndSkillsTestCases(FlowTestCase.RootBotConsumingSkill, false);
        });

        it('middleSkill, sent EoC', async () => {
            await handlesBotAndSkillsTestCases(FlowTestCase.MiddleSkill, true);
        });

        it('leafSkill, sent EoC', async () => {
            await handlesBotAndSkillsTestCases(FlowTestCase.LeafSkill, true);
        });
    });

    it('SkillHandlesEoCFromParent', async () => {
        const dialog = new SimpleComponentDialog();
        const testFlow = createTestFlow(dialog, FlowTestCase.LeafSkill);
        await testFlow
            .send('Hi')
            .assertReply('Hello, what is your name?')
            .send({ type: ActivityTypes.EndOfConversation })
            .startTest();
        strictEqual(_dmTurnResult.turnResult.status, DialogTurnStatus.cancelled);
    });

    it('SkillHandlesRepromptFromParent', async () => {
        const dialog = new SimpleComponentDialog();
        const testFlow = createTestFlow(dialog, FlowTestCase.LeafSkill);
        await testFlow
            .send('Hi')
            .assertReply('Hello, what is your name?')
            .send({ type: ActivityTypes.Event, name: DialogEvents.repromptDialog })
            .assertReply('Hello, what is your name?')
            .startTest();
        strictEqual(_dmTurnResult.turnResult.status, DialogTurnStatus.waiting);
    });

    it('SkillShouldReturnEmptyOnRepromptWithNoDialog', async () => {
        const dialog = new SimpleComponentDialog();
        const testFlow = createTestFlow(dialog, FlowTestCase.LeafSkill);
        await testFlow.send({ type: ActivityTypes.Event, name: DialogEvents.repromptDialog }).startTest();
        strictEqual(_dmTurnResult.turnResult.status, DialogTurnStatus.empty);
    });

    it('Trace skill state', async () => {
        const dialog = new SimpleComponentDialog();
        const testFlow = createTestFlow(dialog, FlowTestCase.LeafSkill, true);
        await testFlow
            .send('Hi')
            .assertReply('Hello, what is your name?')
            .assertReply((reply) => {
                strictEqual(reply.type, ActivityTypes.Trace);
                strictEqual(reply.label, 'Skill State');
            })
            .send('SomeName')
            .assertReply('Hello SomeName, nice to meet you!')
            .assertReply((reply) => {
                strictEqual(reply.type, ActivityTypes.Trace);
                strictEqual(reply.label, 'Skill State');
            })
            .startTest();
        strictEqual(_dmTurnResult.turnResult.status, DialogTurnStatus.complete);
    });

    it('Trace bot state', async () => {
        const dialog = new SimpleComponentDialog();
        const testFlow = createTestFlow(dialog, FlowTestCase.RootBotOnly, true);
        await testFlow
            .send('Hi')
            .assertReply('Hello, what is your name?')
            .assertReply((reply) => {
                strictEqual(reply.type, ActivityTypes.Trace);
                strictEqual(reply.label, 'Bot State');
            })
            .send('SomeName')
            .assertReply('Hello SomeName, nice to meet you!')
            .assertReply((reply) => {
                strictEqual(reply.type, ActivityTypes.Trace);
                strictEqual(reply.label, 'Bot State');
            })
            .startTest();
        strictEqual(_dmTurnResult.turnResult.status, DialogTurnStatus.complete);
    });

    it('Gets or sets root dialog', () => {
        const dm = new DialogManager();
        const rootDialog = new SimpleComponentDialog();
        dm.rootDialog = rootDialog;
        ok(dm.dialogs.find(rootDialog.id));
        strictEqual(dm.rootDialog.id, rootDialog.id);
        dm.rootDialog = undefined;
        strictEqual(dm.rootDialog, undefined);
    });

    it('Container registration', async () => {
        const root = new AdaptiveDialog('root').configure({
            triggers: [
                new OnBeginDialog().configure({
                    actions: [new AdaptiveDialog('inner')],
                }),
            ],
        });
        const dm = new DialogManager(root);

        const storage = new MemoryStorage();

        // The inner adaptive dialog should be registered on the DialogManager after onTurn
        const adapter = new TestAdapter(async (context) => {
            await dm.onTurn(context);
        });
        useBotState(adapter, new ConversationState(storage), new UserState(storage));

        await adapter.send('hi').startTest();
        ok(dm.dialogs.find('inner'));
    });

    it('Cyclical dialog structures', async () => {
        const trigger = new OnBeginDialog();

        const root = new AdaptiveDialog('root').configure({
            triggers: [trigger],
        });

        trigger.actions = [new EndTurn(), root];

        const dm = new DialogManager(root);

        const adapter = new TestAdapter(async (context) => {
            // First OnTurn invocation will trigger registration of dependencies.
            // If registration is not protected against cyclical dialog structures,
            // this call will result in a stack overflow.
            await dm.onTurn(context);
        });

        const storage = new MemoryStorage();

        useBotState(adapter, new ConversationState(storage), new UserState(storage));

        await adapter.send('hi').startTest();
    });

    it('Container registration double nesting', async () => {
        const root = new AdaptiveDialog('root').configure({
            triggers: [
                new OnBeginDialog().configure({
                    actions: [
                        new AdaptiveDialog('inner').configure({
                            triggers: [
                                new OnBeginDialog().configure({
                                    actions: [
                                        new AdaptiveDialog('innerinner').configure({
                                            triggers: [
                                                new OnBeginDialog().configure({
                                                    actions: [new SendActivity('hellworld')],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });
        const dm = new DialogManager(root);

        const storage = new MemoryStorage();

        // The inner adaptive dialog should be registered on the DialogManager after onTurn
        const adapter = new TestAdapter(async (context) => {
            await dm.onTurn(context);
        });
        useBotState(adapter, new ConversationState(storage), new UserState(storage));

        await adapter.send('hi').startTest();
        // Top level containers should be registerd.
        ok(dm.dialogs.find('inner'));
        // Mid level containers should be registered.
        ok(dm.dialogs.find('innerinner'));
        // Leaf nodes / non-containers should not be registered.
        strictEqual(
            dm.dialogs.getDialogs().find((d) => d instanceof SendActivity),
            undefined
        );
    });
});
