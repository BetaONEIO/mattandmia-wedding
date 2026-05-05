(() => {
    // wedding → full day (ceremony + meal)
    // meal    → evening meal only
    // Passwords are compared by SHA-256 hash so the words aren't sitting in plain text.
    const ROUTES = [
        { word: 'wedding', target: 'wedding.html', token: 'wedding' },
        { word: 'meal',    target: 'meal.html',    token: 'meal'    },
    ];

    const form  = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const error = document.getElementById('gate-error');

    async function sha256(text) {
        const buf = new TextEncoder().encode(text);
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(hashBuf)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    const hashTable = (async () => {
        const out = {};
        for (const r of ROUTES) out[await sha256(r.word)] = r;
        return out;
    })();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        error.textContent = '';
        const value = input.value.trim().toLowerCase();
        if (!value) return;

        const route = (await hashTable)[await sha256(value)];

        if (!route) {
            error.textContent = "That doesn't look right. Please check your invitation.";
            input.select();
            return;
        }

        try {
            sessionStorage.setItem('mm_access', route.token);
        } catch (_) { /* private mode — fall through */ }
        window.location.href = route.target;
    });
})();
