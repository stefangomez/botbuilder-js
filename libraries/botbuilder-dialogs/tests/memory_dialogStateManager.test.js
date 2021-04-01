const assert = require('assert');
const { ConversationState, UserState, MemoryStorage, TurnContext, TestAdapter } = require('botbuilder-core');

const {
    Dialog,
    DialogSet,
    DialogContext,
    DialogContainer,
    ConversationMemoryScope,
    UserMemoryScope,
    DialogTurnStateConstants,
    SettingsMemoryScope,
} = require('../');

const beginMessage = {
    text: `begin`,
    type: 'message',
    channelId: 'test',
    from: { id: 'user' },
    recipient: { id: 'bot' },
    conversation: { id: 'convo1' },
};

class TestDialog extends Dialog {
    constructor(id, message) {
        super(id);
        this.message = message;
        this.dialogType = 'child';
    }

    async beginDialog(dc) {
        dc.activeDialog.state.isDialog = true;
        await dc.context.sendActivity(this.message);
        return Dialog.EndOfTurn;
    }
}

class TestContainer extends DialogContainer {
    constructor(id, child) {
        super(id);
        if (child) {
            this.dialogs.add(child);
            this.childId = child.id;
        }
        this.dialogType = 'container';
    }

    beginDialog(dc, options) {
        const state = dc.activeDialog.state;
        state.isContainer = true;
        if (this.childId) {
            state.dialog = {};
            const childDc = this.createChildContext(dc);
            return childDc.beginDialog(this.childId, options);
        } else {
            return Dialog.EndOfTurn;
        }
    }

    continueDialog(dc) {
        const childDc = this.createChildContext(dc);
        if (childDc) {
            return childDc.continueDialog();
        } else {
            return Dialog.EndOfTurn;
        }
    }

    createChildContext(dc) {
        const state = dc.activeDialog.state;
        if (state.dialog) {
            const childDc = new DialogContext(this.dialogs, dc.context, state.dialog);
            childDc.parent = dc;
            return childDc;
        }

        return undefined;
    }
}

async function createConfiguredTestDc(storage) {
    const dc = await createTestDc(storage);
    await dc.state.loadAllScopes();

    return dc;
}

async function createTestDc(storage = new MemoryStorage()) {
    const convoState = new ConversationState(storage);
    const userState = new UserState(storage);

    const container = new TestContainer('container', new TestDialog('child', 'test message'));
    const dialogState = convoState.createProperty('dialogs');
    const dialogs = new DialogSet(dialogState).add(container);

    const context = new TurnContext(new TestAdapter(), beginMessage);
    context.turnState.set('ConversationState', convoState);
    context.turnState.set('UserState', userState);
    context.turnState.set(DialogTurnStateConstants.configuration, {});

    const dc = await dialogs.createContext(context);

    // Start container dialog
    await dc.beginDialog('container');
    return dc;
}

describe('Memory - Dialog State Manager', function () {
    this.timeout(5000);

    let dc;
    before(async () => {
        dc = await createConfiguredTestDc();
    });

    it('Should create a standard configuration with added conversation and user state.', function () {
        const config = dc.state.configuration;

        assert(
            config.memoryScopes.find(
                (scope) => scope instanceof ConversationMemoryScope && scope.name === 'conversation'
            ),
            'no conversation scope added'
        );

        assert(
            config.memoryScopes.find((scope) => scope instanceof UserMemoryScope && scope.name === 'user'),
            'no conversation scope added'
        );
    });

    it('Should create a standard configuration by default.', async function () {
        // Create test dc
        const dc = await createTestDc();

        // Run test
        const config = dc.state.configuration;
        assert(config, `No config returned`);
        assert(config.pathResolvers.length > 0, `No path resolvers`);
        assert(config.memoryScopes.length > 0, `No memory scopes`);
    });

    it('Should read & write values to TURN memory scope.', function () {
        dc.state.setValue('turn.foo', 'bar');
        const value = dc.state.getValue('turn.foo');
        assert(value == 'bar', `value returned: ${value}`);
    });

    it('Should read values from the SETTINGS memory scope.', function () {
        const entries = Object.entries(process.env);
        assert(entries.length, 'process.env empty');

        for (const [key, value] of entries) {
            assert.strictEqual(dc.state.getValue(`settings["${key}"]`), value);
        }
    });

    it.only('Should work with legacy SETTINGS', async function () {
        const dc = await createTestDc();

        const initialSettings = { foo: 'bar' };
        dc.context.turnState.set('memoryScopes', [new SettingsMemoryScope(), new SettingsMemoryScope(initialSettings)]);

        await dc.loadAllScopes();
        assert.strictEqual(dc.state.getValue('settings.foo'), 'bar');
    });

    it('Should read & write values to DIALOG memory scope.', function () {
        dc.state.setValue('dialog.foo', 'bar');
        const value = dc.state.getValue('dialog.foo');
        assert(value == 'bar', `value returned: ${value}`);
    });

    it('Should read values from the CLASS memory scope.', function () {
        // Run test
        assert(dc.state.getValue('class.dialogType') === 'container');
        assert(dc.child.state.getValue('class.dialogType') === 'child');
    });

    it('Should read & write values to THIS memory scope.', function () {
        dc.state.setValue('this.foo', 'bar');
        const value = dc.state.getValue('this.foo');
        assert(value == 'bar', `value returned: ${value}`);
    });

    it('Should read & write values to CONVERSATION memory scope.', function () {
        dc.state.setValue('conversation.foo', 'bar');
        const value = dc.state.getValue('conversation.foo');
        assert(value == 'bar', `value returned: ${value}`);
    });

    it('Should read & write values to USER memory scope.', function () {
        dc.state.setValue('user.foo', 'bar');
        const value = dc.state.getValue('user.foo');
        assert(value == 'bar', `value returned: ${value}`);
    });

    it('Should read & write values using $ alias.', function () {
        dc.state.setValue('$foo', 'bar');
        assert(dc.state.getValue('dialog.foo') == 'bar', `setValue() failed to use alias.`);
        assert(dc.state.getValue('$foo') == 'bar', `getValue() failed to use alias.`);
    });

    it('Should read & write values using # alias.', function () {
        dc.state.setValue('#foo', 'bar');
        assert(dc.state.getValue('turn.recognized.intents.foo') == 'bar', `setValue() failed to use alias.`);
        assert(dc.state.getValue('#foo') == 'bar', `getValue() failed to use alias.`);
    });

    it('Should read & write values using @@ alias.', function () {
        dc.state.setValue('@@foo', ['bar']);
        const value = dc.state.getValue('turn.recognized.entities.foo');
        assert(Array.isArray(value) && value.length == 1, `setValue() failed to use alias.`);
        assert(value[0] == 'bar');
    });

    it('Should read entities using @ alias.', function () {
        dc.state.setValue('@@foo', ['foo']);
        dc.state.setValue('@@bar', [['bar']]);
        assert(dc.state.getValue('@foo') == 'foo', `Simple entities not returning.`);
        assert(dc.state.getValue('@bar') == 'bar', `Nested entities not returning.`);

        dc.state.setValue('turn.recognized.entities.single', ['test1', 'test2', 'test3']);
        dc.state.setValue('turn.recognized.entities.double', [
            ['testx', 'testy', 'testz'],
            ['test1', 'test2', 'test3'],
        ]);
        assert.strictEqual(dc.state.getValue('@single'), 'test1');
        assert.strictEqual(dc.state.getValue('@double'), 'testx');
        assert.strictEqual(dc.state.getValue('turn.recognized.entities.single.first()'), 'test1');
        assert.strictEqual(dc.state.getValue('turn.recognized.entities.double.first()'), 'testx');

        dc.state.setValue('turn.recognized.entities.single', [{ name: 'test1' }, { name: 'test2' }, { name: 'test3' }]);
        dc.state.setValue('turn.recognized.entities.double', [
            [{ name: 'testx' }, { name: 'testy' }, { name: 'testz' }],
            [{ name: 'test1' }, { name: 'test2' }, { name: 'test3' }],
        ]);
        assert.strictEqual(dc.state.getValue('@single.name'), 'test1');
        assert.strictEqual(dc.state.getValue('@double.name'), 'testx');
        assert.strictEqual(dc.state.getValue('turn.recognized.entities.single.first().name'), 'test1');
        assert.strictEqual(dc.state.getValue('turn.recognized.entities.double.first().name'), 'testx');
    });

    it('Should write a entity using @ alias.', function () {
        dc.state.setValue('@foo', 'bar');
        assert(dc.state.getValue('@foo') == 'bar', `Entity not round tripping.`);
    });

    it('Should read values using % alias.', function () {
        assert(dc.state.getValue('%dialogType') === 'container');
        assert(dc.child.state.getValue('%dialogType') === 'child');
    });

    it('Should delete values in a scope.', function () {
        dc.state.setValue('turn.foo', 'bar');
        dc.state.deleteValue('turn.foo');
        const value = dc.state.getValue('turn.foo');
        assert(value == undefined, `value returned: ${value}`);
    });

    it('Should persist conversation & user values when saved.', async function () {
        // Create test dc
        const storage = new MemoryStorage();
        let dc = await createConfiguredTestDc(storage);

        // Initialize state and save
        dc.state.setValue('user.name', 'test user');
        dc.state.setValue('conversation.foo', 'bar');
        await dc.state.saveAllChanges();

        // Create new dc and test loaded values
        dc = await createConfiguredTestDc(storage);
        assert(dc.state.getValue('user.name') == 'test user', `user state not saved`);
        assert(dc.state.getValue('conversation.foo') == 'bar', `conversation state not saved`);
    });

    it('Should return default value when getValue() called with empty path.', function () {
        assert(dc.state.getValue('', 'default') == 'default');
    });

    it('Should support passing a function to getValue() for the default.', function () {
        assert(dc.state.getValue('', () => 'default') == 'default');
    });

    it('Should raise an error if getValue() called with an invalid scope.', function () {
        assert.throws(() => dc.state.getValue('foo.bar'));
    });

    it('Should raise an error if setValue() called with missing path.', function () {
        assert.throws(() => dc.state.setValue('', 'bar'));
    });

    it('Should raise an error if setValue() called with an invalid scope.', function () {
        assert.throws(() => dc.state.setValue('foo', 'bar'));
    });

    it('Should overwrite memory when setValue() called with just a scope.', function () {
        dc.state.setValue('turn', { foo: 'bar' });
        assert(dc.state.getValue('turn.foo') == 'bar');
    });

    it('Should raise an error if deleteValue() called with < 2 path path.', function () {
        assert.throws(() => dc.state.deleteValue('conversation'));
    });

    it('Should raise an error if deleteValue() called with an invalid scope.', function () {
        assert.throws(() => dc.state.deleteValue('foo.bar'));
    });

    it('Should read & write array values.', function () {
        dc.state.setValue('turn.foo', ['bar']);
        assert(dc.state.getValue('turn.foo[0]') == 'bar');
    });

    it('Should delete array values by index.', function () {
        dc.state.setValue('turn.test', ['foo', 'bar']);
        dc.state.deleteValue('turn.test[0]');
        assert(dc.state.getValue('turn.test[0]') == 'bar');
    });

    it('Should ignore array deletions that are out of range.', function () {
        dc.state.setValue('turn.test', []);
        dc.state.deleteValue('turn.test[0]');
        assert(dc.state.getValue('turn.test').length == 0);
    });

    it('Should ignore property deletions off non-object properties.', function () {
        dc.state.setValue('turn.foo', []);
        dc.state.deleteValue('turn.foo.bar');
        assert(dc.state.getValue('turn.foo').length == 0);
        dc.state.setValue('turn.bar', 'test');
        dc.state.deleteValue('turn.bar.foo');
        assert(dc.state.getValue('turn.bar') == 'test');
    });

    it('Should ignore property deletions of missing object properties.', function () {
        dc.state.setValue('turn.foo', { test: 'test' });
        dc.state.deleteValue('turn.foo.bar');

        const value = dc.state.getValue('turn.foo');
        assert.deepStrictEqual(value, { test: 'test' });
    });

    it('Should resolve nested expressions.', function () {
        dc.state.setValue('turn.addresses', {
            work: {
                street: 'one microsoft way',
                city: 'Redmond',
                state: 'wa',
                zip: '98052',
            },
        });

        dc.state.setValue('turn.addressKeys', ['work']);
        dc.state.setValue('turn.preferredAddress', 0);

        const value = dc.state.getValue('turn.addresses[turn.addressKeys[turn.preferredAddress]].zip');
        assert.strictEqual(value, '98052');
    });

    it('Should find a property quoted with single quotes.', function () {
        dc.state.setValue('turn.addresses', {
            work: {
                street: 'one microsoft way',
                city: 'Redmond',
                state: 'wa',
                zip: '98052',
            },
        });

        const value = dc.state.getValue(`turn.addresses['work'].zip`);
        assert.strictEqual(value, '98052');
    });

    it('Should find a property quoted with double quotes.', function () {
        dc.state.setValue('turn.addresses', {
            work: {
                street: 'one microsoft way',
                city: 'Redmond',
                state: 'wa',
                zip: '98052',
            },
        });

        const value = dc.state.getValue(`turn.addresses["work"].zip`);
        assert.strictEqual(value, '98052');
    });

    it('Should find a property containing embedded quotes.', function () {
        dc.state.setValue('turn.addresses', {
            '"work"': {
                street: 'one microsoft way',
                city: 'Redmond',
                state: 'wa',
                zip: '98052',
            },
        });

        const value = dc.state.getValue(`turn.addresses['\\"work\\"'].zip`);
        assert.strictEqual(value, '98052');
    });

    it('Should raise an error for paths with miss-matched quotes.', function () {
        assert.throws(() => {
            dc.state.setValue('turn.addresses', {
                work: {
                    street: 'one microsoft way',
                    city: 'Redmond',
                    state: 'wa',
                    zip: '98052',
                },
            });

            dc.state.getValue(`turn.addresses['work"].zip`);
        });
    });

    it('Should raise an error for segments with invalid path chars.', function () {
        assert.throws(() => {
            dc.state.setValue('turn.addresses', {
                '~work': {
                    street: 'one microsoft way',
                    city: 'Redmond',
                    state: 'wa',
                    zip: '98052',
                },
            });

            dc.state.getValue(`turn.addresses.~work.zip`);
        });
    });

    it('Should raise an error for assignments to a negative array index.', function () {
        assert.throws(() => dc.state.setValue(`turn.foo[-1]`, 'test'));
    });

    it('Should raise an error for array assignments to non-array values.', function () {
        assert.throws(() => {
            dc.state.setValue('turn.foo', 'bar');
            dc.state.setValue(`turn.foo[3]`, 'test');
        });
    });

    it('Should raise an error for un-matched brackets.', function () {
        assert.throws(() => dc.state.setValue(`turn.foo[0`, 'test'));
    });

    it('Should alow indexer based path lookups.', function () {
        dc.state.setValue('turn.foo', 'bar');
        const value = dc.state.getValue('["turn"].["foo"]');
        assert.strictEqual(value, 'bar');
    });

    it('Should return "undefined" for index lookups again non-arrays.', function () {
        dc.state.setValue('turn.foo', 'bar');
        assert.strictEqual(dc.state.getValue('turn.foo[2]'), undefined);
    });

    it('Should return "undefined" when first() called for empty array.', function () {
        dc.state.setValue('turn.foo', []);
        assert.strictEqual(dc.state.getValue('turn.foo.first()'), undefined);
    });

    it('Should return "undefined" when first() called for empty nested array.', function () {
        dc.state.setValue('turn.foo', [[]]);
        assert.strictEqual(dc.state.getValue('turn.foo.first()'), undefined);
    });

    it('Should return "undefined" for a missing segment.', function () {
        dc.state.setValue('turn.foo', 'bar');
        const value = dc.state.getValue('turn..foo');
        assert.strictEqual(value, undefined);
    });

    it('Should raise an error for paths starting with a ".".', function () {
        assert.throws(() => dc.state.setValue('.turn.foo', 'bar'));
    });
});
