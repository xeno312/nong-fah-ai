require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const crisis = require('./crisis');
const llm = require('./llm');
const resources = require('./resources');
const alerting = require('./alerting');

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SESSIONS = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_TURNS = 20;
const KEEP_TURNS = 10;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 20;
const RATE_BUCKETS = new Map();

function cleanupSessions() {
    const now = Date.now();
    for (const [sid, s] of SESSIONS) {
        if (now - s.last > SESSION_TTL_MS) SESSIONS.delete(sid);
    }
}

function rateOk(sid) {
    const now = Date.now();
    const bucket = RATE_BUCKETS.get(sid) || [];
    const fresh = bucket.filter((t) => now - t <= RATE_WINDOW_MS);
    if (fresh.length >= RATE_LIMIT) { RATE_BUCKETS.set(sid, fresh); return false; }
    fresh.push(now);
    RATE_BUCKETS.set(sid, fresh);
    return true;
}

app.post('/api/new-session', (req, res) => {
    const sid = crypto.randomBytes(24).toString('base64url');
    SESSIONS.set(sid, { history: [], summary: '', last: Date.now(), province: null, alertedAt: 0 });
    res.json({ session_id: sid });
});

app.post('/api/chat', async (req, res) => {
    cleanupSessions();

    const body = req.body || {};
    const sid = String(body.session_id || '');
    const message = String(body.message || '').slice(0, 4000);
    const province = body.province ? String(body.province) : null;

    if (!sid || sid.length < 8) return res.status(400).json({ error: 'bad session' });
    if (!message.trim()) return res.status(400).json({ error: 'empty message' });
    if (!rateOk(sid)) return res.status(429).json({ error: 'slow down' });

    let sess = SESSIONS.get(sid);
    if (!sess) {
        sess = { history: [], summary: '', last: Date.now(), province, alertedAt: 0 };
        SESSIONS.set(sid, sess);
    }
    sess.last = Date.now();
    if (province) sess.province = province;

    // 1. ระบบ Summarization (พร้อม Fallback & Limit ป้องกัน Overflow)
    if (sess.history.length >= MAX_TURNS) {
        const toSummarize = sess.history.slice(0, MAX_TURNS - KEEP_TURNS);
        const newSummary = await llm.summarize(toSummarize);

        sess.summary = sess.summary ? `${sess.summary}\n- ${newSummary}` : newSummary;

        // 🔥 FIX: ป้องกัน Context Window บวมเกิน 1,500 ตัวอักษร
        if (sess.summary.length > 1500) {
            sess.summary = sess.summary.slice(-1500);
        }

        sess.history = sess.history.slice(MAX_TURNS - KEEP_TURNS);
    }

    const base = crisis.detect(message);
    const effectiveTier = crisis.escalate(base.tier, sess.history);

    if (effectiveTier >= 2 && !sess.alertedAt) {
        sess.alertedAt = Date.now();
        const reason = base.matches.length ? base.matches.join(', ') : 'escalation';
        alerting.alertOperator(sid, effectiveTier, reason).catch(() => { });
    }

    sess.history.push({ role: 'user', content: message, _tier: base.tier });
    const trimmed = sess.history.slice(-MAX_TURNS * 2);

    let reply;
    try {
        reply = await llm.chat(trimmed, effectiveTier, sess.summary);
    } catch (e) {
        console.error(`[llm error] ${e.message}`);
        return res.json({
            reply: 'ฟ้าขอโทษ ระบบมีปัญหานิดหน่อย ถ้าเร่งด่วนโทร 1323 ได้เลย เขาพร้อมฟังตลอด 24 ชั่วโมง',
            crisis_tier: effectiveTier,
            resources: resources.acuteBundle(sess.province),
            suggest_restart: false,
        });
    }

    sess.history.push({ role: 'assistant', content: reply });

    let attached = [];
    if (effectiveTier >= 2) attached = resources.forProvince(sess.province);
    else if (effectiveTier === 1) attached = resources.NATIONAL.slice(0, 3);

    res.json({
        reply,
        crisis_tier: effectiveTier,
        resources: attached,
        suggest_restart: sess.history.length >= MAX_TURNS * 2,
    });
});

app.get('/api/resources', (req, res) => {
    res.json(resources.forProvince(req.query.province || null));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    const mode = llm.isFallbackMode() ? 'fallback (rule-based)' : 'LLM';
    const alertingOn = (process.env.ALERT_WEBHOOK || '').startsWith('http');
    console.log(`น้องฟ้า listening on http://localhost:${PORT}`);
    console.log(`mode: ${mode}`);
    console.log(`alerts: ${alertingOn ? 'on' : 'off (ALERT_WEBHOOK not set)'}`);
});