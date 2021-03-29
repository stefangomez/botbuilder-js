// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from 'assert';

/**
 * Override environment variables using `beforeEach`/`afterEach`
 *
 * @param overrides environment variables to override
 */
export function withEnvironment(overrides: Record<string, string>): void {
    beforeEach(function () {
        const { ...oldEnv } = process.env;
        this.oldEnv = oldEnv;
        process.env = { ...oldEnv, ...overrides };
    });

    afterEach(function () {
        const { oldEnv } = this;
        assert.ok(oldEnv, '`oldEnv` undefined');
        process.env = oldEnv;
    });
}
