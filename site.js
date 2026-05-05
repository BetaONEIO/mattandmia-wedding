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
