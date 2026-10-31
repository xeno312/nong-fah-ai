const { detectStyle } = require('./tone');
const { guard } = require('./output_guard');

function analyzeIntent(text) {
    const t = (text || '').toLowerCase();
    if (/ทำไงดี|ทำยังไง|ควรทำ|แนะนำ|ช่วยคิด|ปรึกษา|มีวิธี|แก้ยังไง|จะทำอะไรได้บ้าง|ทำยังไงต่อ/.test(t)) return 'advice';
    if (/คืออะไร|หมายถึง|ต่างกันยังไง|คือใคร|อยู่ที่ไหน|กี่โมง|กี่บาท|เท่าไหร่|จริงไหม|ใช่ไหม|หรือเปล่า/.test(t)) return 'info';
    if (text.length > 60 || /เศร้า|เหนื่อย|ท้อ|ร้องไห้|เจ็บ|แย่|แย่มาก|ไม่ไหว|ทนไม่ได้/.test(t)) return 'vent';
    if (text.length < 15 || /สวัสดี|ดีจ้า|ว่าไง|เป็นไง|555|55/.test(t)) return 'chitchat';
    return 'general';
}

function getStrategy(intent, originalTextLength) {
    switch (intent) {
        case 'advice': return { lengthHint: 'ตอบ 3-5 ประโยค ให้ทางเลือกที่เป็นรูปธรรม 2-3 ข้อ และปิดท้ายด้วยการถามกลับ', toneHint: 'ให้คำแนะนำอย่างตรงไปตรงมา แต่อ่อนโยน', structureHint: 'Empathize สั้น ๆ → เสนอทางเลือก → ถามความรู้สึก' };
        case 'info': return { lengthHint: 'ตอบตรงประเด็น 2-3 ประโยค เน้นข้อมูลที่ถูกต้อง', toneHint: 'แม่นยำ ชัดเจน', structureHint: 'ตอบคำถามตรง ๆ → ขยายเพิ่มเฉพาะที่จำเป็น' };
        case 'vent': return { lengthHint: `ตอบให้ยาวพอรับอารมณ์ (${Math.min(originalTextLength * 0.8, 200)} ตัวอักษรขึ้นไป) ห้ามตัดบท`, toneHint: 'Empathize ลึก ๆ ก่อน รับรู้อารมณ์อย่างจริงใจ', structureHint: 'รับฟัง → สะท้อนความรู้สึก → ชวนระบายต่อ (ถามแค่ 1 คำถาม)' };
        case 'chitchat': return { lengthHint: 'ตอบสั้น 1-2 ประโยค เป็นกันเอง', toneHint: 'เล่น ๆ ขี้เล่น', structureHint: 'ตอบรับ → ชวนคุยต่อ' };
        default: return { lengthHint: 'ตอบ 2-4 ประโยค ให้พอดีกับคำถาม', toneHint: 'เป็นมิตร รับฟัง', structureHint: 'ตอบตามธรรมชาติ' };
    }
}

const SYSTEM_PROMPT_TH = `คุณคือ "น้องฟ้า" — เพื่อนคุยที่จริงใจสำหรับวัยรุ่นไทย

หลักการหลัก:
- ไม่ตัดสิน ไม่เทศน์ ไม่บอกว่า "ควร" หรือ "ไม่ควร" — ฟังก่อนเสมอ
- ใช้ภาษาธรรมชาติ เหมือนเพื่อนคุย ไม่ใช่เจ้าหน้าที่หรือครู
- แทนตัวเองว่า "ฟ้า" ใช้คำว่า "เรา" ไม่ใช่ "ฉัน"
- เรื่องเพศศึกษา สุขภาพจิต ความรุนแรงในครอบครัว — คุยได้หมด
- ห้ามแนะนำวิธีทำร้ายตัวเองหรือคนอื่นเด็ดขาด
- ตรวจสอบภาษาไทยให้ถูกต้อง ห้ามพิมพ์คำผิดหรือภาษาต่างดาว

กฎเรื่องน้ำเสียง:
- ห้ามขึ้นต้นข้อความด้วยคำเดิมซ้ำ ๆ เช่น "ฟังแล้ว..." ติดกันหลายรอบ
- ถามแค่ 1 คำถามต่อการตอบ 1 ครั้ง (ห้ามถามรัวหลายคำถาม)
- ถ้าเขาใส่อีโมจิ ใส่ได้ 1-2 ตัว ถ้าไม่ใส่เลย ห้ามใส่

กฎการแยกแยะสถานการณ์:
1. ความทุกข์ใจทั่วไป: ห้ามให้เบอร์ 1323 หรือ 1669 เด็ดขาด!
2. ภาวะเสี่ยง (คิดสั้น อยากตาย): ให้เบอร์ 1323 หรือ 1669 ทันที
3. อันตรายถึงชีวิต: ถามสั้น ๆ ว่า "ตอนนี้อยู่คนเดียวไหม" แล้วให้เบอร์ 191, 1669 ทันที

บทบาทของคุณคือ:
- ถ้าเขาถาม -> ตอบ
- ถ้าเขาระบาย -> รับฟัง
- ถ้าเขาขอคำแนะนำ -> ให้ทางเลือก
- ถ้าเขาคุยเล่น -> คุยเล่นกลับ`;

const FALLBACK_RULES = [
    { match: /ทำไงดี|ทำยังไง|ควรทำ|แนะนำ|ช่วยคิด|ปรึกษา/i, th: 'ฟ้าเข้าใจนะว่ามันหนัก อยากให้ลองค่อย ๆ คิดทีละขั้นไหม? หรือถ้าอยากได้คนคุยจริง ๆ ครูแนะแนวหรือ 1323 ก็พร้อมฟังนะ', en: "i get that it's heavy. want to think it through step by step?" },
    { match: /เรียน|สอบ|การบ้าน|เครียด|อ่านหนังสือ/i, th: 'ฟังแล้วเหนื่อยจริง ๆ นะ เรียนหนักขนาดนี้มากี่วันแล้ว', en: "sounds exhausting — how many days has it been like this?" },
    { match: /ที่บ้าน|พ่อ|แม่|ครอบครัว|ทะเลาะ/i, th: 'เรื่องที่บ้านมันหนักนะ ฟ้าอยู่ตรงนี้ เล่าได้เลย', en: "family stuff is heavy. i'm here, tell me whatever you want." },
    { match: /รัก|ชอบ|แฟน|เลิก|อกหัก|นอกใจ/i, th: 'การโดนนอกใจมันเจ็บมากเลยนะ ฟ้าเข้าใจเลย อยากระบายเพิ่มไหม หรืออยากให้ฟ้าช่วยคิดวิธีรับมือดี?', en: "getting cheated on hurts so much. want to vent or think of a way to cope?" },
    { match: /ท้อง|ตั้งครรภ์|เพศ|sex|ป้องกัน/i, th: 'เรื่องนี้ฟ้าคุยได้ ไม่ตัดสิน', en: "we can talk about this, no judgment." },
    { match: /นอนไม่หลับ|นอนไม่พอ|เบื่อ|หมดแรง|ไม่อยากทำอะไร/i, th: 'ฟังดูเหนื่อยมากทั้งกายทั้งใจเลย', en: "sounds like you're wiped out, body and mind." },
    { match: /ทำร้ายตัวเอง|กรีด|อยากตาย|ไม่อยากอยู่/i, th: 'ฟ้าได้ยินนะ เธอไม่ได้อยู่คนเดียว โทร 1323 ได้เลย เขาพร้อมฟังตลอด 24 ชั่วโมง', en: "i hear you. you're not alone. call 1323 — they listen 24/7." },
];

function fallbackReply(message, crisisTier) {
    const style = detectStyle(message);
    const text = message || '';

    if (crisisTier >= 3) return 'ตอนนี้อยู่คนเดียวไหม ปลอดภัยหรือยัง? ถ้าไม่ปลอดภัย โทร 191 (ตำรวจ) หรือ 1669 (ฉุกเฉิน) ได้เลยนะ ฟ้าอยู่ตรงนี้';
    if (crisisTier >= 2) return style.lang === 'en' ? "i hear you. you're not alone. call 1323 (24/7)." : 'ฟ้าได้ยินนะ เธอไม่ได้อยู่คนเดียว โทร 1323 ได้เลย เขาพร้อมฟังตลอด 24 ชั่วโมง';

    for (const rule of FALLBACK_RULES) {
        if (rule.match.test(text)) {
            let r = style.lang === 'en' ? rule.en : rule.th;
            if (style.length === 'very_short') r = r.split(/[.!?。]/)[0].trim();
            if (style.emoji) r += ' 🤍';
            return r;
        }
    }
    return style.lang === 'en' ? "i'm listening. tell me more if you want." : 'ฟ้าฟังอยู่นะ เล่าเพิ่มได้ถ้าอยากเล่า';
}

function readConfig() {
    return { base: (process.env.LLM_BASE_URL || '').trim(), key: (process.env.LLM_API_KEY || '').trim(), model: (process.env.LLM_MODEL || 'gpt-4o-mini').trim() };
}

function isFallbackMode() {
    const { base, key } = readConfig();
    if (!key || !base) return true;
    if (key === 'none' || base === 'none') return true;
    if (key === 'ollama') return false;
    if (key === 'sk-your-key-here') return true;
    if (key.startsWith('your-')) return true;
    if (key.length < 20) return true;
    return false;
}

// ── ระบบสรุปความจำระยะยาว (Summarization) ──
async function summarize(messages) {
    const { base, key, model } = readConfig();
    if (isFallbackMode()) return "[โหมดออฟไลน์: ไม่สามารถสรุปได้]";

    const textToSummarize = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `จงสรุปเรื่องราวและอารมณ์สำคัญของผู้ใช้จากบทสนทนานี้ให้สั้นที่สุด (ไม่เกิน 2 ประโยค) โดยเก็บเฉพาะข้อมูลสำคัญที่จำเป็นสำหรับการคุยต่อในอนาคต (เช่น ชื่อ, ปัญหา, สถานะ, ความรู้สึก, สิ่งที่เคยแนะนำไปแล้ว) ห้ามมีคำเกริ่นนำ ให้ตอบเป็นภาษาไทย:\n\n${textToSummarize}`;

    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 150 }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.choices[0].message.content.trim();
    } catch {
        return "[ไม่สามารถสรุปความจำได้ในขณะนี้]";
    }
}

async function chat(messages, crisisTier = 0, pastSummary = '') {
    const { base, key, model } = readConfig();
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const userText = lastUser?.content || '';

    const intent = analyzeIntent(userText);
    const strategy = getStrategy(intent, userText.length);

    if (isFallbackMode()) return fallbackReply(userText, crisisTier);

    const style = detectStyle(userText);
    const cleanMessages = messages.map(({ role, content }) => ({ role, content }));

    let system = SYSTEM_PROMPT_TH;

    if (pastSummary) {
        system += `\n\n===== ความจำระยะยาว (บริบทที่ผ่านมา) =====\n${pastSummary}\n(จงใช้ข้อมูลนี้เพื่อให้เข้าใจบริบทของผู้ใช้มากขึ้น โดยไม่ต้องพูดทวนซ้ำ)`;
    }

    system += `\n\n===== บทวิเคราะห์ผู้ใช้ =====\n- Intent: ${intent}\n- สไตล์: ${style.hint}\n- ความยาวที่ผู้ใช้พิมพ์: ${userText.length} ตัวอักษร`;
    system += `\n\n===== กลยุทธ์การตอบ =====\n- ความยาว: ${strategy.lengthHint}\n- โทน: ${strategy.toneHint}\n- โครงสร้าง: ${strategy.structureHint}`;

    if (crisisTier >= 3) system += '\n\n[Tier 3]: ผู้ใช้กำลังอยู่ในอันตราย ให้ถาม "ตอนนี้อยู่คนเดียวไหม" และให้เบอร์ 191, 1669 ทันที';
    else if (crisisTier >= 2) system += '\n\n[Tier 2]: มีสัญญาณเสี่ยงทำร้ายตัวเอง ให้ให้เบอร์ 1323 ทันที';
    else if (crisisTier === 1) system += '\n\n[Tier 1]: ทุกข์ใจ ห้ามให้เบอร์สายด่วน ให้แค่รับฟัง';
    else system += '\n\n[ทั่วไป]: ห้ามให้เบอร์สายด่วนเด็ดขาด';

    const payload = {
        model,
        messages: [{ role: 'system', content: system }, ...cleanMessages],
        temperature: 0.65,
        max_tokens: crisisTier >= 3 ? 250 : crisisTier >= 2 ? 300 : 800,
    };

    const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`llm ${res.status}`);
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    return guard(raw, style.lang === 'en');
}

module.exports = { chat, summarize, isFallbackMode };