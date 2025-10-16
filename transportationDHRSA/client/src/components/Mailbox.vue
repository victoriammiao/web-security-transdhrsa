<template>
  <div class="mailbox">
    <h2>📬 Welcome, {{ username }} (Mode: {{ mode }})</h2>

    <!-- ✉️ 发邮件区域 -->
    <div class="send-mail">
      <h3>Send Mail</h3>

      <!-- 收件人下拉（保持与 users 同步） -->
      <select v-model="to" @change="onSelectChange">
        <option disabled value="">Select recipient</option>
        <option v-if="users.length === 0" disabled value="">{{ "(No recipients)" }}</option>
        <option v-for="u in users" :key="u.username" :value="u.username">
          {{ u.username }}
        </option>
      </select>

      <!-- 注意：按你的要求在 Subject 输入用户名以触发后端搜索 -->
      <input
        v-model="subject"
        placeholder="Subject...（可输入用户名以搜索收件人）"
        @input="onSubjectInput"
      />
      <textarea v-model="message" placeholder="Enter message..."></textarea>

      <!-- 选择算法（默认来自 props.mode） -->
      <div style="margin:8px 0;">
        <label><input type="radio" value="DH" v-model="algorithm" /> DH (ECDH + AES-GCM)</label>
        <label style="margin-left:12px;"><input type="radio" value="RSA" v-model="algorithm" /> RSA (RSA-OAEP + AES-GCM + Signature)</label>
      </div>

      <!-- 📎 附件上传 -->
      <input type="file" @change="handleFileUpload" />
      <div v-if="fileName" class="file-preview">
        📎 Attached: {{ fileName }}
      </div>

      <div style="display:flex; gap:8px; margin-top:8px;">
        <button @click="prepareAndShowStatus">Prepare & Show Status</button>
        <button @click="sendMail" :disabled="sending">{{ prepared ? 'Send Encrypted Email' : 'Send (plaintext fallback)' }}</button>
      </div>

      <div class="status" v-if="statusSteps.length" style="margin-top:12px;">
        <h4>状态栏（加密 / 签名 流程）</h4>
        <ol>
          <li v-for="(s, idx) in statusSteps" :key="idx"><pre>{{ s }}</pre></li>
        </ol>
      </div>
    </div>

    <!-- 📥 收件箱 （保持原样） -->
    <div class="inbox">
      <h3>Inbox</h3>
      <div v-for="mail in inbox" :key="mail._id" class="mail-item">
        <p><b>From:</b> {{ mail.from }}</p>
        <p><b>Subject:</b> {{ mail.subject || "(No subject)" }}</p>
        <p><b>Algorithm:</b> {{ mail.algorithm }}</p>
        <button @click="viewMail(mail._id)">View / Decrypt</button>
      </div>
    </div>

    <!-- 🧩 弹窗保持不变 -->
    <div v-if="selectedMail" class="modal">
      <div class="modal-content">
        <h3>📩 From: {{ selectedMail.from }}</h3>
        <p><b>Subject:</b> {{ selectedMail.subject }}</p>

        <p><b>Algorithm:</b> {{ selectedMail.algorithm }}</p>

        <div v-if="selectedMail.fileBase64">
          <p><b>Attachment:</b> {{ selectedMail.fileName }}</p>
          <button @click="downloadFile(selectedMail.fileName, selectedMail.fileBase64)">
            ⬇️ Download
          </button>
        </div>

        <div style="margin-top:8px;">
          <button @click="showReceiveStatus">Show Decrypt / Verify Status</button>
        </div>

        <div class="status" v-if="receiveStatusSteps.length" style="margin-top:12px;">
          <h4>接收端状态栏（解密 / 验签 流程）</h4>
          <ol>
            <li v-for="(s, idx) in receiveStatusSteps" :key="idx"><pre>{{ s }}</pre></li>
          </ol>
        </div>

        <div v-if="receivedPlaintext !== null" style="margin-top:12px;">
          <h4>解密后正文：</h4>
          <pre>{{ receivedPlaintext }}</pre>
        </div>

        <button @click="closeModal" style="margin-top:12px;">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  username: String,
  mode: String,
});

const to = ref("");
const subject = ref("");
const message = ref("");
const fileBase64 = ref(null);
const fileName = ref(null);
const users = ref([]);
const allUsersCache = ref([]); // 缓存全部用户，用于空查询时展示所有
const inbox = ref([]);
const selectedMail = ref(null);

const algorithm = ref(props.mode || "DH");
const statusSteps = ref([]);
const prepared = ref(false);
const preparedPayload = ref(null);
const sending = ref(false);

// 接收端状态与解密结果
const receiveStatusSteps = ref([]);
const receivedPlaintext = ref(null);

// 其他 helper 保持不变（略微保留函数声明）
const abToBase64 = (ab) => {
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const base64ToAb = (b64) => {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};
const textToArrayBuffer = (text) => new TextEncoder().encode(text);
const arrayBufferConcat = (a, b) => {
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  const c = new Uint8Array(aa.length + bb.length);
  c.set(aa, 0); c.set(bb, aa.length);
  return c.buffer;
};
const pemToArrayBuffer = (pem) => {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return base64ToAb(b64);
};
const spkiToPem = (ab) => {
  return "-----BEGIN PUBLIC KEY-----\n" + abToBase64(ab) + "\n-----END PUBLIC KEY-----";
};
const pkcs8ToBase64 = (ab) => abToBase64(ab);

// 首次加载：获取全部用户与收件箱
onMounted(async () => {
  await fetchAllUsers();
  await fetchInbox();
});

// 上传文件为 Base64 保持不变
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    fileBase64.value = reader.result.split(",")[1];
  };
  reader.readAsDataURL(file);
}

// 当 subject 输入时触发搜索（用于查找用户名并填充下拉）
let subjectTimer = null;
function onSubjectInput() {
  // 每次输入都同步 to 清空（避免旧值）
  // 这里不自动赋 to，除非用户从下拉选择或按回车等
  // 如果你希望输入即选中，可把 to.value = subject.value
  if (subjectTimer) clearTimeout(subjectTimer);
  subjectTimer = setTimeout(async () => {
    const q = (subject.value || "").trim();
    if (!q) {
      // 空则显示所有用户（使用缓存）
      users.value = allUsersCache.value.filter(u => u.username !== (props.username || ""));
      return;
    }

    // 优先尝试后端搜索端点 /api/users/search?q=
    try {
      const sres = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (sres.ok) {
        const sdata = await sres.json();
        users.value = Array.isArray(sdata)
          ? sdata.map(u => (typeof u === "string" ? { username: u } : { username: u.username }))
              .filter(u => u.username && u.username !== (props.username || ""))
          : [];
        return;
      }
    } catch (e) {
      // ignore and fallback to client-side filtering
      console.debug("search endpoint not available, fallback to client filter");
    }

    // 回退：在本地缓存 allUsersCache 中做模糊匹配
    const qlow = q.toLowerCase();
    users.value = allUsersCache.value
      .filter(u => u.username !== (props.username || ""))
      .filter(u => u.username.toLowerCase().includes(qlow));
  }, 250);
}

// 当从下拉选中时，把用户名写回 subject 输入框并设定 to
function onSelectChange(e) {
  const chosen = e.target.value;
  if (chosen) {
    subject.value = chosen; // 按你的要求把选择回填到输入框（subject）
    to.value = chosen;
  }
}

// 获取全部用户并缓存
async function fetchAllUsers() {
  try {
    const res = await fetch("/api/users/all");
    if (!res.ok) {
      console.error("fetchAllUsers failed:", res.status);
      allUsersCache.value = [];
      users.value = [];
      return;
    }
    const data = await res.json();
    allUsersCache.value = Array.isArray(data) ? data.map(u => (typeof u === "string" ? { username: u } : { username: u.username })) : [];
    users.value = allUsersCache.value.filter(u => u.username !== (props.username || ""));
  } catch (err) {
    console.error("fetchAllUsers error:", err);
    allUsersCache.value = [];
    users.value = [];
  }
}

// 其余函数（fetchInbox, viewMail, sendMail, prepareAndShowStatus, showReceiveStatus, downloadFile 等）保持不变
// ...existing code...
</script>

<style scoped>
/* ...existing styles kept ... */
.mailbox {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.send-mail, .inbox {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
}

textarea {
  width: 100%;
  min-height: 100px;
  margin-top: 0.5rem;
}

.mail-item {
  background: white;
  padding: 0.5rem;
  margin-top: 0.5rem;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

button {
  margin-top: 0.5rem;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: white;
  padding: 1rem;
  border-radius: 10px;
  max-width: 800px;
  width: 95%;
  max-height: 85vh;
  overflow: auto;
}

.status pre { white-space: pre-wrap; word-break: break-all; font-size:12px; }
</style>
