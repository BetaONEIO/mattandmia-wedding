(() => {
    const target = document.getElementById('countdown');
    if (!target) return;

    const dateAttr = target.dataset.date;
    if (!dateAttr) return;

    const weddingTs = new Date(dateAttr).getTime();
    const $days  = document.getElementById('cd-days');
    const $hours = document.getElementById('cd-hours');
    const $mins  = document.getElementById('cd-mins');
    const $secs  = document.getElementById('cd-secs');

    function tick() {
        const diff = weddingTs - Date.now();
        if (diff <= 0) {
            $days.textContent = $hours.textContent = $mins.textContent = $secs.textContent = '0';
            target.classList.add('countdown--past');
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        $days.textContent  = d;
        $hours.textContent = String(h).padStart(2, '0');
        $mins.textContent  = String(m).padStart(2, '0');
        $secs.textContent  = String(s).padStart(2, '0');
    }

    tick();
    setInterval(tick, 1000);

    // Sign out clears the gate token and returns to the landing page.
    document.querySelectorAll('[data-signout]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            try { sessionStorage.removeItem('mm_access'); } catch (_) {}
            window.location.href = 'index.html';
        });
    });
})();

// RSVP form — submit via FormSubmit's AJAX endpoint so failures (timeouts,
// activation-pending, etc.) show up on the page instead of just disappearing.
(() => {
    document.querySelectorAll('.rsvp-form').forEach((form) => {
        const status = form.querySelector('.rsvp-status');
        const button = form.querySelector('button[type="submit"]');
        if (!status || !button) return;

        const ajaxAction = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            status.hidden = false;
            status.className = 'rsvp-status rsvp-status--sending';
            status.textContent = 'Sending…';
            button.disabled = true;

            try {
                const res = await fetch(ajaxAction, {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    body: new FormData(form),
                });
                if (!res.ok) throw new Error('status ' + res.status);
                status.className = 'rsvp-status rsvp-status--success';
                status.textContent = 'Thank you — your RSVP has been sent!';
                form.reset();
            } catch (err) {
                status.className = 'rsvp-status rsvp-status--error';
                status.textContent = 'Sorry, that didn’t send (the form service may be temporarily down). Please try again in a minute, or use the email link below.';
            } finally {
                button.disabled = false;
            }
        });
    });
})();

// Story carousel — crossfade through photos on a fixed interval.
(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.story-carousel').forEach((root) => {
        const imgs = root.querySelectorAll('.story-carousel__img');
        if (imgs.length < 2) return;
        const interval = parseInt(root.dataset.interval || '5000', 10);
        let i = 0;
        const advance = () => {
            imgs[i].classList.remove('is-active');
            i = (i + 1) % imgs.length;
            imgs[i].classList.add('is-active');
        };
        if (reduced) return;
        setInterval(advance, interval);
    });
})();
