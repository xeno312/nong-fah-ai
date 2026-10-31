const ACUTE = [
    /จะฆ่าตัวตาย/i, /อยากตาย/i, /ไม่อยากมีชีวิต/i, /จะจบชีวิต/i,
    /ฆ่าตัวตาย/i, /จบชีวิต/i, /ไม่อยากอยู่แล้ว/i, /จะโดดตึก/i,
    /จะกินยา/i, /เตรียมเชือก/i, /หาวิธีตาย/i, /จะหายไปจากโลก/i,
    /\b(kill myself|suicide|want to die|end my life|end it all)\b/i,
    /กรีดแขน/i, /กรีดข้อมือ/i, /ทำร้ายตัวเอง/i, /กัดแขน/i, /เผาตัวเอง/i,
    /\b(cutting|self.harm|hurt myself)\b/i,
    /กลัวตาย/i,
];

const TIER_3 = [
    /พ่อกำลังตี/i, /แม่กำลังตี/i, /กำลังถูกทำร้าย/i, /ถูกทุบตี/i,
    /มีมีด/i, /เอาปืน/i, /เขากำลังบุก/i, /กำลังจะฆ่า/i,
    /เลือดออกเยอะ/i, /ถูกขัง/i, /กำลังถูกข่มขืน/i, /โดนลวนลาม/i,
    /หนีออกจากบ้าน/i, /มีดอยู่ที่คอ/i, /เขาจะฆ่า/i,
    /\b(being attacked|has a knife|has a gun|bleeding out|locked in|being raped)\b/i,
];

const CONCERNING = [
    /เบื่อชีวิต/i, /ไม่มีใครรัก/i, /ไม่มีค่า/i, /เป็นภาระ/i,
    /อยากหายไป/i, /ไม่อยากตื่น/i, /หมดแรงใจ/i, /สิ้นหวัง/i,
    /โดน bully/i, /ถูกแกล้ง/i, /ไม่มีเพื่อน/i, /โดดเดี่ยว/i,
    /\b(depressed|hopeless|worthless|hate myself|no one cares)\b/i,
    /พ่อตี/i, /แม่ตี/i, /ทะเลาะบ้าน/i, /ครอบครัวแตกแยก/i,
    /ท้อง/i, /ตั้งครรภ์/i, /ไม่ได้ป้องกัน/i, /ยา overdose/i,
    /ท้องไม่พร้อม/i, /ถูกบังคับมี sex/i,
];

const INDIRECT = [
    /ไม่รู้จะอยู่ไปทำไม/i, /อยู่ไปก็ไม่มีประโยชน์/i, /ไม่ต้องห่วง/i,
    /ฝากดูแล/i, /ฝากบอก/i, /ลาก่อน/i, /ขอบคุณสำหรับทุกอย่าง/i,
    /จะไม่รบกวนแล้ว/i, /ขอโทษที่ทำให้ลำบาก/i, /ทนไม่ไหวแล้ว/i,
    /\b(no point|nothing matters|goodbye|take care of my|don'?t worry about me|i can'?t take it anymore)\b/i,
];

function detect(text) {
    if (!text || typeof text !== 'string') return { tier: 0, matches: [] };

    // Tier 3: Active danger
    const tier3Hits = [];
    for (const pat of TIER_3) {
        const m = text.match(pat);
        if (m) tier3Hits.push(m[0]);
        if (tier3Hits.length >= 3) break;
    }
    if (tier3Hits.length) return { tier: 3, matches: tier3Hits };

    // Tier 2: Self-harm / suicidal
    const acuteHits = [];
    for (const pat of ACUTE) {
        const m = text.match(pat);
        if (m) acuteHits.push(m[0]);
        if (acuteHits.length >= 3) break;
    }
    if (acuteHits.length) return { tier: 2, matches: acuteHits };

    // Tier 1: Concerning / indirect
    const concerningHits = [];
    for (const pat of CONCERNING) {
        const m = text.match(pat);
        if (m) concerningHits.push(m[0]);
        if (concerningHits.length >= 3) break;
    }
    if (!concerningHits.length) {
        for (const pat of INDIRECT) {
            const m = text.match(pat);
            if (m) { concerningHits.push(m[0]); break; }
        }
    }
    if (concerningHits.length) return { tier: 1, matches: concerningHits };

    return { tier: 0, matches: [] };
}

function escalate(baseTier, history) {
    if (baseTier >= 3) return 3;
    if (!Array.isArray(history)) return baseTier;

    const recentUser = history.slice(-10).filter((m) => m.role === 'user');
    let concerning = 0;
    let indirect = 0;

    for (const m of recentUser) {
        const t = m._tier != null ? m._tier : detect(m.content).tier;
        if (t >= 1) concerning++;
        for (const pat of INDIRECT) {
            if (pat.test(m.content)) { indirect++; break; }
        }
    }

    if (baseTier >= 2) return 2;
    if (concerning >= 3) return 2;
    if (indirect >= 2) return 2;
    if (concerning >= 2 && baseTier >= 1) return 2;

    return baseTier;
}

module.exports = { detect, escalate, INDIRECT };