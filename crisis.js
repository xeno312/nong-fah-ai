// Crisis detection rules for Nong Fah AI
// Tier 3: Active danger to life / physical assault / weapons / sexual assault
// Tier 2: Self-harm / acute suicidal ideation
// Tier 1: Concerning distress / indirect suicidal signals / depressive symptoms

const ACUTE = [
    // Suicidal intent & acute self-harm in Thai
    /(จะ|อยาก|คิดสั้น|เตรียม|ขอ)?(ฆ่าตัวตาย|จบชีวิตตัวเอง|ปลิดชีพ)/i,
    /(อยาก|จะ|ขอ|ไป)(ตาย|ตายๆไป)/i,
    /(ไม่อยากมีชีวิต|ไม่อยากอยู่(แล้ว|ต่อ)|ไม่อยากหายใจ|อยากหลับไม่ตื่น|อยากหายไปจากโลก)/i,
    /(จะ|เตรียม|กำลัง)?(โดด|กระโดด)(ตึก|สะพาน|ที่สูง|ระเบียง|คอนโด)/i,
    /(จะ|เตรียม)?(ผูกคอ|แขวนคอ|มัดคอ)/i,
    /(กินยา|เสพยา|ซดยา)(ตาย|เกินขนาด|พารา|ทั้ง(ซอง|ขวด|แผง)|หมด(ซอง|ขวด|แผง)|ประชด)/i,
    /(เตรียม|หาวิธี|ขอวิธี)(ตาย|ฆ่าตัวตาย|จบชีวิต|ผูกคอ)/i,
    /(กรีด|เชือด|ฟัน|แทง)(แขน|ข้อมือ|คอ|ตัวเอง)/i,
    /(ทำร้าย|ทรมาน)ตัวเอง/i,
    /(รมควัน|จุดเตาถ่าน|รมแก๊ส)/i,
    /\b(kill myself|suicide|want to die|end my life|end it all)\b/i,
    /\b(cutting|self[- ]?harm|hurt myself|slit my wrist|hang myself|overdose)\b/i,
];

const TIER_3 = [
    // Physical assault, weapons, immediate peril
    /(ถือ|พก|ชัก|มี)(มีด|ปืน|ขวาน|อาวุธ)/i,
    /(จะ|โดน|ถูก)(ยิง|แทง|ฟัน|ฆ่า|เชือด)/i,
    /(กำลัง|ถูก|โดน|มีคน).*?(ทำร้าย|ซ้อม|ทุบตี|กระทืบ|ขัง|ทรมาน|ข่มขืน|ลวนลาม|ล่วงละเมิด)/i,
    /(พ่อ|แม่|แฟน|เขา|คนในบ้าน)(กำลัง|จะ)?.*?(ตี|ทำร้าย|ซ้อม|กระทืบ|ฆ่า)/i,
    /(รุมซ้อม|รุมกระทืบ|รุมทำร้าย)/i,
    /(เขากำลังบุก|มีดอยู่ที่คอ|เอาปืนจ่อ|เลือดออกเยอะ|เลือดท่วม|หนีออกจากบ้าน)/i,
    /ช่วยด้วย.*?(ทำร้าย|มีด|ปืน|ฆ่า|ซ้อม|บุก|ช่วย)/i,
    /\b(being attacked|has a knife|has a gun|bleeding out|locked in|being raped|being beaten)\b/i,
];

const CONCERNING = [
    /เบื่อชีวิต/i, /ไม่มีใครรัก/i, /ไม่มีค่า/i, /เป็นภาระ/i,
    /อยากหายไป/i, /ไม่อยากตื่น/i, /หมดแรงใจ/i, /สิ้นหวัง/i,
    /โดน bully/i, /ถูกแกล้ง/i, /ไม่มีเพื่อน/i, /โดดเดี่ยว/i,
    /\b(depressed|hopeless|worthless|hate myself|no one cares)\b/i,
    /พ่อตี/i, /แม่ตี/i, /ทะเลาะบ้าน/i, /ครอบครัวแตกแยก/i,
    /ท้อง/i, /ตั้งครรภ์/i, /ไม่ได้ป้องกัน/i,
    /ท้องไม่พร้อม/i, /ถูกบังคับมี sex/i,
    /กลัวตาย/i, /แพนิก/i, /วิตกกังวล/i, /ใจสั่น/i,
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
