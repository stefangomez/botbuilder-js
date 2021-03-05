// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { start } from 'botbuilder-runtime-integration-express';

start(process.cwd(), process.cwd(), {
    port: 3979,
}).catch(console.error);
