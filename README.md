```markdown
# น้องฟ้า (Nong Fah AI) 

> **A safe, non-judgmental space for Thai teens to talk about mental health, relationships, and life.**

วัยรุ่นไทยจำนวนมากไม่มีใครให้คำตอบเรื่องเพศศึกษา สุขภาพจิต หรือความรุนแรงในครอบครัว "น้องฟ้า" ถูกสร้างขึ้นมาเป็นพื้นที่ปลอดภัย ไม่ตัดสิน ไม่เทศน์ และไม่ปล่อยให้ใครอยู่คนเดียว

โปรเจกต์นี้เป็นแชทบอท Open-source ที่ขับเคลื่อนด้วย LLM แต่มี **ระบบคัดกรองความเสี่ยง (Crisis Detection)** ฝั่งเซิร์ฟเวอร์ที่ทำงานก่อน AI จะตอบ หากพบสัญญาณอันตราย ระบบจะแสดงสายด่วนช่วยเหลือจริงในทันที เพื่อให้มั่นใจว่าผู้ใช้จะได้รับความช่วยเหลือจากคนจริงเมื่อต้องการมากที่สุด

---

##  Features

- ** Crisis Detection (Tier 1 & 2):** สแกนข้อความภาษาไทยและอังกฤษก่อนส่งให้ LLM จับสัญญาณการทำร้ายตัวเอง ความรุนแรงในครอบครัว และคำพูดเชิงลบแบบอ้อม
- ** Emergency Resources:** แนบสายด่วน (1323, 1669, 1387, 1300) และเบอร์โรงพยาบาลจิตเวชประจำจังหวัดทันทีเมื่อตรวจพบความเสี่ยงระดับวิกฤต
- ** Tone Mirroring:** ปรับสไตล์การตอบให้เหมือนเพื่อนที่คุยด้วย ทั้งความยาวของข้อความ ระดับภาษา (กันเอง/ทางการ) การใช้อีโมจิ และภาษา (ไทย/อังกฤษ)
- ** Output Moderation:** กรองคำตอบของ AI ป้องกันการแนะนำวิธีที่เป็นอันตรายหรือข้อมูลทางการแพทย์ที่ผิด
- ** Operator Alerts:** ส่งแจ้งเตือนผ่าน Discord/Slack Webhook เมื่อเกิดเหตุการณ์ Tier-2 (ส่งเฉพาะ Session Hash ไม่ส่งเนื้อหาแชท)
- ** Privacy First:** ไม่บันทึกประวัติแชทลงฐานข้อมูล ไม่เก็บ IP ไม่ต้องบอกชื่อจริง (Session อยู่ใน Memory และหมดอายุใน 1 ชั่วโมง)
- ** Fallback Mode:** หากไม่ได้ตั้งค่า API Key ระบบจะทำงานด้วย Rule-based Engine ทันที ไม่พัง ไม่ต้องต่อเน็ต

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML, CSS, JavaScript (Zero dependencies, Light/Dark mode)
- **AI Integration:** OpenAI-compatible API (OpenAI, Groq, Ollama)
- **Database:** None (In-memory session store for privacy)

---

##  Project Structure

```text
nong-fah-ai/
│
├── index.html              # Main frontend (Single-file UI)
├── package.json            # Dependencies & scripts
├── .env.example            # Environment variables template
│
├── crisis.js               # Tier 1 & 2 pattern matching + escalation
├── tone.js                 # Analyzes user's message style
├── output_guard.js         # Filters harmful AI responses
├── alerting.js             # Operator webhook notifications
├── resources.js            # National & provincial hotlines
├── llm.js                  # LLM API integration + Fallback logic
│
└── server.js               # Express server & API endpoints
```

---

##  Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/nong-fah-ai.git
cd nong-fah-ai
npm install
```

### 2. Configure Environment

คัดลอกไฟล์ตัวอย่างและตั้งค่าคีย์ของคุณ:

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env`:

```env
# โหมด Fallback (ไม่ต้องใช้ LLM ก็รันได้)
LLM_API_KEY=none
LLM_BASE_URL=none
LLM_MODEL=none
PORT=8000
ALERT_WEBHOOK=
```

**หรือถ้าต้องการใช้ LLM จริง (แนะนำ Groq ฟรี):**
```env
LLM_API_KEY=gsk_xxxxxxxxxxxxxxxxx
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b
PORT=8000
ALERT_WEBHOOK=https://discord.com/api/webhooks/xxx/yyy
```

### 3. Run the Server

```bash
npm start
```

เปิดเบราว์เซอร์ไปที่: **http://localhost:8000**

---

##  Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | API Key ของผู้ให้บริการ LLM | `none` |
| `LLM_BASE_URL` | Base URL ของ OpenAI-compatible API | `none` |
| `LLM_MODEL` | ชื่อโมเดล (เช่น `llama-3.3-70b-versatile`) | `none` |
| `PORT` | พอร์ตของ Express Server | `8000` |
| `ALERT_WEBHOOK` | Discord/Slack Webhook สำหรับแจ้งเตือน Tier-2 | `(เว้นว่าง)` |

---

##  Safety & Privacy

โปรเจกต์นี้ถูกออกแบบมาเพื่อ **"รับฟัง"** ไม่ใช่ **"รักษา"**:

1. **ไม่บันทึกแชท:** ข้อมูลบทสนทนาจะอยู่ใน Memory ของ Server เท่านั้น (ล้างเมื่อปิดเซิร์ฟเวอร์ หรือหมดเวลา 1 ชั่วโมง)
2. **ไม่ใช้ข้อมูลเทรน:** เราไม่นำข้อความของผู้ใช้ไปใช้ปรับปรุงโมเดล
3. **ไม่ใช่แพทย์:** AI ไม่สามารถวินิจฉัยหรือสั่งยาได้ หากพบความเสี่ยง ระบบจะแนะนำให้ติดต่อผู้เชี่ยวชาญทันที

---

##  Contributing

เรายินดีรับ Pull Requests โดยเฉพาะ:
- การเพิ่มสายด่วน/โรงพยาบาลใน 77 จังหวัด (`resources.js`)
- การปรับปรุง Pattern การจับสัญญาณเสี่ยง (`crisis.js`)
- การแปล UI เป็นภาษาถิ่น

---

##  License

MIT License — นำไปใช้ พัฒนาต่อ หรือปรับให้เข้ากับชุมชนของคุณได้เลย

---

*"เรื่องที่เธอไม่กล้าเล่าให้ใครฟัง ฟ้าฟังอยู่นะ"*
```
