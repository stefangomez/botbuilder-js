// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const { ComponentRegistration } = require('botbuilder-core');
const { DialogsComponentRegistration } = require('..');

before(function () {
    ComponentRegistration.add(new DialogsComponentRegistration());
});
