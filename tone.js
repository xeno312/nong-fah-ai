const THAI_RANGE = /[\u0E00-\u0E7F]/;

function detectStyle(text) {
    const t = (text || '').trim();
    if (!t) return { lang: 'th', length: 'short', register: 'casual', emoji: false, hint: '' };

    const isThai = THAI_RANGE.test(t);
    const lang = isThai ? 'th' : 'en';

    const len = t.length;
    let length;
    if (len <= 15) length = 'very_short';
    else if (len <= 40) length = 'short';
    else if (len <= 120) length = 'medium';
    else length = 'long';

    const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t);
    const hasExclaim = /!|！/.test(t);
    const hasQuestion = /\?|？|ไหม|มั้ย|หรอ|หรือเปล่า/.test(t);
    const isFormal = /ครับ|ค่ะ|คะ|ดิฉัน|กระผม|ขอความกรุณา|เรียนท่าน/.test(t);
    const isSlangy = /555|5555|จ้า|จ๊ะ|อ่ะ|อะ|ป่ะ|มั้ย|มึง|กู|เอ๊ย|ว่ะ/.test(t);
    const isALL_CAPS = lang === 'en' && t.length > 5 && t === t.toUpperCase();
    const isLowerOnly = lang === 'en' && t.length > 5 && t === t.toLowerCase();

    let register = 'casual';
    if (isFormal) register = 'formal';
    else if (isSlangy) register = 'slangy';
    else if (isALL_CAPS) register = 'loud';
    else if (isLowerOnly) register = 'relaxed';

    const parts = [];
    parts.push(`language: reply in ${lang === 'th' ? 'Thai' : 'English'} (same as user)`);
    parts.push(`length: ${length} — reply in the same approximate length, don't over-explain`);
    parts.push(`register: ${register} — match the user's formality level`);
    parts.push(`punctuation: ${hasExclaim ? 'user used exclamation marks — you can too' : 'no exclamation marks unless user used them'}`);
    parts.push(`emoji: ${hasEmoji ? 'user used emoji — you may use 1-2 in the same spirit' : 'user used no emoji — do not use emoji'}`);
    if (hasQuestion) parts.push('user asked a question — answer or ask back in the same style');

    return {
        lang, length, register, emoji: hasEmoji,
        hint: parts.join('\n- '),
    };
}

module.exports = { detectStyle };