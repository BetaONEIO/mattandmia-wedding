import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const site = await readFile(new URL('../site.js', import.meta.url), 'utf8');
const guard = await readFile(new URL('../guard.js', import.meta.url), 'utf8');
test('photo page sign-out works without a countdown and does not attach RSVP handling to uploads', () => {
    let signout, uploadHandlers = 0, rsvpHandlers = 0, cleared;
    const context = {
        document: {
            getElementById: () => null,
            querySelectorAll: selector => {
                if (selector === '[data-signout]') return [{ addEventListener: (_, fn) => { signout = fn; } }];
                const rsvp = { querySelector: () => ({}), addEventListener: () => { rsvpHandlers++; } };
                const upload = { querySelector: () => ({}), addEventListener: () => { uploadHandlers++; } };
                if (selector === '.rsvp-form') return [rsvp, upload];
                if (selector === '.rsvp-form[action="/api/rsvp"]') return [rsvp];
                return [];
            },
        },
        matchMedia: () => ({ matches: true }),
        sessionStorage: { removeItem: key => { cleared = key; } },
        window: { location: {} },
    };
    vm.runInNewContext(site, context);
    assert.equal(uploadHandlers, 0);
    assert.equal(rsvpHandlers, 1);
    signout({ preventDefault() {} });
    assert.equal(cleared, 'mm_access');
    assert.equal(context.window.location.href, 'index.html');
});
test('direct photo visits return through the invitation gate; both guest roles have access', () => {
    for (const token of [null, 'ceremony', 'wedding']) {
        let redirected;
        vm.runInNewContext(guard, {
            document: { currentScript: { dataset: { requires: 'ceremony' } } },
            sessionStorage: { getItem: () => token },
            window: { location: { pathname: '/photos', replace: path => { redirected = path; } } },
        });
        assert.equal(redirected, token ? undefined : 'index.html?next=photos');
    }
});
