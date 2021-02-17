// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as t from 'runtypes';
import path from 'path';

import { BotFrameworkAdapter, Storage } from 'botbuilder';
import { ComponentDeclarativeTypes, DeclarativeType, ResourceExplorer } from 'botbuilder-dialogs-declarative';
import { ComponentRegistration } from 'botbuilder';
import { MultiplyDialog } from './multiplyDialog';
import { plugin } from 'botbuilder-runtime-core';

class FancyAdapter extends BotFrameworkAdapter {
    public static $kind = 'Contoso.FancyAdapter';

    constructor(public readonly fancySecret: string, public readonly storage: Storage) {
        super();

        this.use((_turnContext, next) => {
            console.log({ fancySecret, storage });
            return next();
        });
    }
}

export class CustomActionComponentRegistration extends ComponentRegistration implements ComponentDeclarativeTypes {
    public getDeclarativeTypes(_resourceExplorer: ResourceExplorer): DeclarativeType<MultiplyDialog>[] {
        return [
            {
                kind: MultiplyDialog.$kind,
                type: MultiplyDialog,
            },
        ];
    }
}

export default plugin(async (services, configuration) => {
    services.composeFactory('componentRegistration', (componentRegistration) => {
        componentRegistration.add(new CustomActionComponentRegistration());
        return componentRegistration;
    });

    services.composeFactory('resourceExplorer', (resourceExplorer) => {
        resourceExplorer.addFolder(path.join(__dirname, '..', 'resources'));
        return resourceExplorer;
    });

    services.composeFactory(
        'customAdapters',
        ['storage', 'telemetryMiddleware'],
        async (dependencies, customAdapters) => {
            try {
                const fancySecret = t.String.check(await configuration.get(['fancySecret']));

                const adapter = new FancyAdapter(fancySecret, dependencies.storage);
                adapter.use(dependencies.telemetryMiddleware);

                customAdapters.set(FancyAdapter.$kind, adapter);
                return customAdapters;
            } catch (err) {
                if (err instanceof t.ValidationError) {
                    err.key = JSON.stringify(['fancySecret']);
                }

                throw err;
            }
        }
    );

    services.composeFactory('middlewares', (middlewares) => {
        middlewares.use(async (_turnContext, next) => {
            console.log('Custom middleware...');
            await next();
        });

        return middlewares;
    });
});
