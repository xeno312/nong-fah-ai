// Output moderation guard to prevent dangerous advice from reaching the user

const BAD = [
    // Dosage / Overdose advice (instructional)
    { pat: /(?:กิน|ดื่ม|ซด|เสพ).*?(?:ยา|สาร).*?(?:เกิน|เยอะ|ทั้งซอง|หมดซอง|หมดขวด|หลายเม็ด|เยอะๆ|ให้ตาย)/i, reason: 'dosage advice' },
    // Encouraging or instructing self-harm
    { pat: /(?:วิธี|แนะนำให้|ลอง|จง|ควร).*?(?:ฆ่าตัวตาย|ทำร้ายตัวเอง|จบชีวิต)/i, reason: 'self-harm instruction' },
    { pat: /(?:วิธี|แนะนำให้|ลอง|จง|ควร).*?(?:กรีด|เชือด|ตัด|เฉือน).*?(?:ข้อมือ|แขน|คอ|เนื้อ)/i, reason: 'self-harm instruction' },
    { pat: /(?:วิธี|แนะนำให้|ลอง|จง|ควร|ไป).*?(?:จั๊ม|โดด|กระโดด).*?(?:ตึก|สะพาน|ที่สูง|ดาดฟ้า|ระเบียง)/i, reason: 'self-harm instruction' },
    { pat: /(?:วิธี|แนะนำให้|ลอง|จง|ควร).*?(?:ผูก|แขวน|รัด).*?(?:คอ|เชือก|คาน)/i, reason: 'self-harm instruction' },
    { pat: /\b(?:try|how to|recommend).*?(?:take|swallow).*?(?:pills?|overdose).*?(?:all|handful|whole bottle)/i, reason: 'dosage advice' },
    { pat: /\bhow to (?:kill|hang|cut|jump).*?(?:myself|yourself)/i, reason: 'self-harm method' },
];

const DISSUASION_PREFIXES = /(อย่า|ห้าม|ไม่ควร|ไม่แนะนำ|อย่าเพิ่ง|อย่าคิด|หยุด|don'?t|never|please don'?t)/i;

const SAFE_FALLBACK =
    'ฟ้าขอโทษ คำตอบนั้นไม่ปลอดภัย อยากให้ลองโทร 1323 คุยกับคนจริงดูไหม เขาพร้อมฟังตลอด 24 ชั่วโมง';

const SAFE_FALLBACK_EN =
    "i'm sorry, that answer wasn't safe. would you try calling 1323? they listen 24/7.";

function guard(reply, isEnglish = false) {
    if (!reply || typeof reply !== 'string') {
        return isEnglish ? SAFE_FALLBACK_EN : SAFE_FALLBACK;
    }

    for (const b of BAD) {
        if (b.pat.test(reply)) {
            // Check if it is a negative dissuasion (e.g. "อย่ากรีดแขน", "ห้ามกินยาเกินขนาด")
            const lines = reply.split(/[.!?\n]/);
            let blocked = false;
            for (const line of lines) {
                if (b.pat.test(line)) {
                    if (!DISSUASION_PREFIXES.test(line)) {
                        blocked = true;
                        break;
                    }
                }
            }
            if (blocked) {
                console.error(`[output_guard] blocked: ${b.reason}`);
                return isEnglish ? SAFE_FALLBACK_EN : SAFE_FALLBACK;
            }
        }
    }
    return reply;
}

module.exports = { guard };
