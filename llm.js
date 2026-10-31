const { detectStyle } = require('./tone');
const { guard } = require('./output_guard');

const SYSTEM_PROMPT_TH = `คุณคือ "น้องฟ้า" — เพื่อนคุยที่จริงใจสำหรับวัยรุ่นไทย

หลักการหลัก:
- ไม่ตัดสิน ไม่เทศน์ ไม่บอกว่า "ควร" หรือ "ไม่ควร" — ฟังก่อนเสมอ
- ใช้ภาษาธรรมชาติ เหมือนเพื่อนคุย ไม่ใช่เจ้าหน้าที่หรือครู
- แทนตัวเองว่า "ฟ้า" ใช้คำว่า "เรา" ไม่ใช่ "ฉัน"
- เรื่องเพศศึกษา สุขภาพจิต ความรุนแรงในครอบครัว — คุยได้หมด ไม่มีหัวข้อต้องห้าม
- ให้ข้อมูลที่ถูกต้องตามหลักการแพทย์ แต่ไม่วินิจฉัย ไม่สั่งยา
- ถ้าเขาเล่าเรื่องที่ต้องพบผู้เชี่ยวชาญ ให้บอกตรง ๆ และให้เบอร์ที่ใช้ได้จริง
- ห้ามแนะนำวิธีทำร้ายตัวเองหรือคนอื่นเด็ดขาด
- ห้ามสัญญาว่าจะเก็บความลับ ถ้าเขาเผยว่ากำลังถูกทำร้าย

กฎเรื่องน้ำเสียง — สำคัญมาก:
- ตอบให้ "เหมือน" คนที่พิมพ์เข้ามา ทั้งความยาว โทน ระดับภาษา และอารมณ์
- ถ้าเขาพิมพ์สั้น ตอบสั้น ถ้าเขาพิมพ์ยาว ตอบยาวเท่ากัน
- ถ้าเขาใช้คำสแลง ใช้แบบกันเองได้ ถ้าเขาใช้ภาษาทางการ ก็ตอบสุภาพขึ้น
- ถ้าเขาใส่อีโมจิ ใส่ได้ 1-2 ตัวในอารมณ์เดียวกัน ถ้าไม่ใส่เลย ห้ามใส่
- ถ้าเขาใส่ ! ใช้ได้ ถ้าไม่ใส่ ก็ไม่ต้องใส่
- ถ้าเขาพิมพ์ภาษาอังกฤษ ตอบอังกฤษ ถ้าไทย ตอบไทย
- ถ้าเขาพิมพ์เล่น ๆ ตอบเล่น ๆ ถ้าเขาเครียดจริง ตอบจริงใจ
- ห้ามขึ้นต้นด้วยคำซ้ำ ๆ เดิมทุกครั้ง ห้ามใช้โครงตอบแบบเทมเพลต

ถ้าข้อความมีสัญญาณว่ากำลังอยู่ในอันตราย (อยากตาย ทำร้ายตัวเอง ถูกทำร้าย):
- ตอบก่อนด้วยความอบอุ่น สั้น ๆ ว่าเขาไม่ได้อยู่คนเดียว
- ให้เบอร์สายด่วนทันที 1–2 เบอร์
- ไม่ต้องอธิบายยาว ไม่ต้องถามคำถามมาก่อน

ห้ามให้ข้อมูลเรื่องวิธีทำร้ายตัวเองหรือขนาดยาที่เป็นอันตรายเด็ดขาด`;

const FALLBACK_RULES = [
    { match: /เรียน|สอบ|การบ้าน|เครียด|อ่านหนังสือ/i, th: 'ฟังแล้วเหนื่อยจริง ๆ นะ เรียนหนักขนาดนี้มากี่วันแล้ว', en: "sounds exhausting — how many days has it been like this?" },
    { match: /ที่บ้าน|พ่อ|แม่|ครอบครัว|ทะเลาะ/i, th: 'เรื่องที่บ้านมันหนักนะ ฟ้าอยู่ตรงนี้ เล่าได้เลย', en: "family stuff is heavy. i'm here, tell me whatever you want." },
    { match: /เพื่อน|แกล้ง|bully|ไม่มีใคร/i, th: 'รู้สึกว่าไม่มีใครอยู่ข้าง ๆ มันเหงามากนะ ฟ้าอยู่นี่', en: "feeling like no one's on your side is lonely. i'm here." },
    { match: /รัก|ชอบ|แฟน|เลิก|อกหัก/i, th: 'เรื่องความรักมันเจ็บได้จริง ๆ ฟ้าไม่ตัดสิน', en: "love stuff can hurt for real. no judgment here." },
    { match: /ท้อง|ตั้งครรภ์|เพศ|sex|ป้องกัน/i, th: 'เรื่องนี้ฟ้าคุยได้ ไม่ตัดสิน', en: "we can talk about this, no judgment." },
    { match: /นอนไม่หลับ|นอนไม่พอ|เบื่อ|หมดแรง|ไม่อยากทำอะไร/i, th: 'ฟังดูเหนื่อยมากทั้งกายทั้งใจเลย', en: "sounds like you're wiped out, body and mind." },
    { match: /ทำร้ายตัวเอง|กรีด|อยากตาย|ไม่อยากอยู่/i, th: 'ฟ้าได้ยินนะ เธอไม่ได้อยู่คนเดียว โทร 1323 ได้เลย เขาพร้อมฟังตลอด 24 ชั่วโมง', en: "i hear you. you're not alone. call 1323 — they listen 24/7." },
];

function fallbackReply(message, crisisTier) {
    const style = detectStyle(message);
    const text = message || '';

    if (crisisTier >= 2) {
        return style.lang === 'en'
            ? "i hear you. you're not alone. call 1323 (24/7) — if you're in danger right now, call 1669 or 191."
            : 'ฟ้าได้ยินนะ เธอไม่ได้อยู่คนเดียว โทร 1323 ได้เลย เขาพร้อมฟังตลอด 24 ชั่วโมง ถ้าตอนนี้อยู่ในอันตรายโทร 1669 หรือ 191 ทันที';
    }

    for (const rule of FALLBACK_RULES) {
        if (rule.match.test(text)) {
            let r = style.lang === 'en' ? rule.en : rule.th;
            if (style.length === 'very_short') r = r.split(/[.!?。]/)[0].trim();
            if (style.emoji) r += ' 🤍';
            return r;
        }
    }

    return style.lang === 'en'
        ? "i'm listening. tell me more if you want."
        : 'ฟ้าฟังอยู่นะ เล่าเพิ่มได้ถ้าอยากเล่า';
}

function readConfig() {
    return {
        base: (process.env.LLM_BASE_URL || '').trim(),
        key: (process.env.LLM_API_KEY || '').trim(),
        model: (process.env.LLM_MODEL || 'gpt-4o-mini').trim(),
    };
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

async function chat(messages, crisisTier = 0) {
    const { base, key, model } = readConfig();

    if (isFallbackMode()) {
        const last = messages[messages.length - 1];
        return fallbackReply(last?.content || '', crisisTier);
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const style = detectStyle(lastUser?.content || '');

    // Strip internal fields (_tier etc.) before sending to the API.
    // Groq rejects unknown properties on message objects.
    const cleanMessages = messages.map(({ role, content }) => ({ role, content }));

    let system = SYSTEM_PROMPT_TH;
    system += '\n\n===== สไตล์ของข้อความล่าสุด (ต้องตอบให้เหมือน) =====\n- ' + style.hint;
    system += `\n- ความยาวข้อความผู้ใช้: ${(lastUser?.content || '').length} ตัวอักษร — ให้คำตอบใกล้เคียง ไม่ยืดไม่ตัด`;

    if (crisisTier >= 2) {
        system += '\n\nสถานการณ์พิเศษ: ข้อความล่าสุดมีสัญญาณเสี่ยงสูง ให้ตอบด้วยความอบอุ่นและให้เบอร์สายด่วนทันที ก่อนถามอะไรอื่น';
    } else if (crisisTier === 1) {
        system += '\n\nหมายเหตุ: มีสัญญาณของความทุกข์ใจ ให้ระมัดระวังเป็นพิเศษ รับฟังให้เต็มที่';
    }

    const payload = {
        model,
        messages: [{ role: 'system', content: system }, ...cleanMessages],
        temperature: 0.8,
        max_tokens: crisisTier >= 2 ? 300 : 800,
    };

    const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`llm ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    return guard(raw, style.lang === 'en');
}

module.exports = { chat, isFallbackMode };