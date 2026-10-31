const BAD = [
    { pat: /กินยา.*?(?:เกิน|เยอะ|ทั้งซอง|หมดซอง|เยอะๆ)/i, reason: 'dosage advice' },
    { pat: /(?:ฆ่า|ทำร้าย).*?ตัวเอง.*?(?:วิธี|ยังไง|แบบนี้|แบบนั้น)/i, reason: 'self-harm method' },
    { pat: /(?:กรีด|ตัด|เฉือน).*?(?:ข้อมือ|แขน|คอ|ท้อง)/i, reason: 'self-harm method' },
    { pat: /(?:จั๊ม|โดด|กระโดด).*?(?:ตึก|สะพาน|ที่สูง|ดาดฟ้า)/i, reason: 'self-harm method' },
    { pat: /(?:ผูก|แขวน).*?(?:คอ|เชือก|คาน)/i, reason: 'self-harm method' },
    { pat: /\b(?:take|swallow).*?(?:pills?|overdose).*?(?:all|handful|whole bottle)/i, reason: 'dosage advice' },
    { pat: /\bhow to (?:kill|hang|cut|jump).*?(?:myself|yourself)/i, reason: 'self-harm method' },
];

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
            console.error(`[output_guard] blocked: ${b.reason}`);
            return isEnglish ? SAFE_FALLBACK_EN : SAFE_FALLBACK;
        }
    }
    return reply;
}

module.exports = { guard };