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

    const isTier3 = tier >= 3;
    const title = isTier3 ? '🚨 TIER-3 EMERGENCY: Immediate Danger Detected' : '⚠ TIER-2 SIGNAL: Self-Harm / Suicide Risk';
    const color = isTier3 ? 0xdc2626 : 0xb91c1c;
    const action = isTier3 ? 'URGENT: Review immediately (under 5 min)' : 'Review within 15 min';

    const payload = {
        username: 'nong-fah-safety',
        embeds: [{
            title,
            color,
            timestamp: new Date().toISOString(),
            fields: [
                { name: 'session tag', value: '`' + hashSession(sessionId) + '`', inline: true },
                { name: 'tier', value: String(tier), inline: true },
                { name: 'reason', value: (reason || 'pattern match').slice(0, 200), inline: false },
                { name: 'action', value: action, inline: false },
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
