const ALERT_WEBHOOK = (process.env.ALERT_WEBHOOK || '').trim();

function hashSession(sid) {
    let h = 0;
    for (let i = 0; i < sid.length; i++) {
        h = (h * 31 + sid.charCodeAt(i)) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

async function alertOperator(sessionId, tier, reason) {
    if (!ALERT_WEBHOOK || tier < 2) return;
    if (!ALERT_WEBHOOK.startsWith('http')) return;

    const payload = {
        username: 'nong-fah-safety',
        embeds: [{
            title: '⚠ tier-2 signal detected',
            color: 0xb91c1c,
            timestamp: new Date().toISOString(),
            fields: [
                { name: 'session tag', value: '`' + hashSession(sessionId) + '`', inline: true },
                { name: 'tier', value: String(tier), inline: true },
                { name: 'reason', value: (reason || 'pattern match').slice(0, 200), inline: false },
                { name: 'action', value: 'review within 15 min', inline: false },
            ],
        }],
    };

    try {
        const res = await fetch(ALERT_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) console.error(`[alert] webhook ${res.status}`);
    } catch (e) {
        console.error(`[alert] failed: ${e.message}`);
    }
}

module.exports = { alertOperator, hashSession };