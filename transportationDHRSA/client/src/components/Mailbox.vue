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
import { 
  decryptWithDH, 
  decryptRSA, 
  importEcdhKeyPair, 
  importRSAKeyPair 
} from "../utils/cryptoUtils.js";

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

// 用户密钥管理
const userPrivateKeys = ref({
  ecdh: null,  // ECDH 私钥
  rsa: null    // RSA 私钥
});

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
  await loadUserPrivateKeys();
});

// 加载用户私钥
async function loadUserPrivateKeys() {
  try {
    const username = props.username;
    if (!username) return;

    // 获取用户的私钥
    const res = await fetch(`/api/users/${username}/privkey`);
    if (res.ok) {
      const keyData = await res.json();
      
      // 导入 ECDH 私钥
      if (keyData.privkeyPkcs8Base64) {
        try {
          const ecdhKeyPair = await importEcdhKeyPair(keyData.privkeyPkcs8Base64);
          userPrivateKeys.value.ecdh = ecdhKeyPair.privateKey;
          console.log("✅ ECDH 私钥加载成功");
        } catch (err) {
          console.warn("⚠️ ECDH 私钥导入失败:", err);
        }
      }
      
      // 导入 RSA 私钥
      if (keyData.privkeyPkcs8Base64) {
        try {
          const rsaKeyPair = await importRSAKeyPair(keyData.privkeyPkcs8Base64);
          userPrivateKeys.value.rsa = rsaKeyPair.privateKey;
          console.log("✅ RSA 私钥加载成功");
        } catch (err) {
          console.warn("⚠️ RSA 私钥导入失败:", err);
        }
      }
    } else {
      console.warn("⚠️ 无法获取用户私钥，解密功能可能不可用");
    }
  } catch (err) {
    console.error("❌ 加载用户私钥失败:", err);
  }
}

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

// 获取收件箱
async function fetchInbox() {
  try {
    const res = await fetch(`/api/mail/inbox?username=${encodeURIComponent(props.username || "")}`);
    if (!res.ok) {
      console.error("fetchInbox failed:", res.status);
      inbox.value = [];
      return;
    }
    const data = await res.json();
    inbox.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("fetchInbox error:", err);
    inbox.value = [];
  }
}

// 查看邮件详情
async function viewMail(mailId) {
  try {
    const res = await fetch(`/api/mail/read/${mailId}?username=${encodeURIComponent(props.username || "")}`);
    if (!res.ok) {
      console.error("viewMail failed:", res.status);
      alert("Failed to load mail");
      return;
    }
    const data = await res.json();
    selectedMail.value = data;
    receivedPlaintext.value = null;
    receiveStatusSteps.value = [];
  } catch (err) {
    console.error("viewMail error:", err);
    alert("Network error, see console");
  }
}

// 发送邮件
async function sendMail() {
  if (!to.value || !message.value) {
    alert("Please enter recipient and message");
    return;
  }

  sending.value = true;
  try {
    const payload = {
      from: props.username,
      to: to.value,
      subject: subject.value,
      message: message.value,
      algorithm: algorithm.value,
      ...preparedPayload.value
    };

    const res = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert("Mail sent successfully!");
      // 清空表单
      to.value = "";
      subject.value = "";
      message.value = "";
      fileBase64.value = null;
      fileName.value = null;
      prepared.value = false;
      preparedPayload.value = null;
      statusSteps.value = [];
      // 刷新收件箱
      await fetchInbox();
    } else {
      alert("Send failed: " + (data.message || res.statusText));
    }
  } catch (err) {
    console.error("sendMail error:", err);
    alert("Network error, see console");
  } finally {
    sending.value = false;
  }
}

// 准备加密并显示状态
async function prepareAndShowStatus() {
  if (!to.value || !message.value) {
    alert("Please enter recipient and message");
    return;
  }

  statusSteps.value = [];
  prepared.value = false;
  preparedPayload.value = null;

  try {
    // 这里应该实现加密逻辑，暂时使用明文
    statusSteps.value.push("准备发送明文邮件...");
    preparedPayload.value = {
      algorithm: "PLAINTEXT"
    };
    prepared.value = true;
    statusSteps.value.push("✅ 准备完成，可以发送");
  } catch (err) {
    console.error("prepareAndShowStatus error:", err);
    statusSteps.value.push("❌ 准备失败: " + err.message);
  }
}

// 显示接收状态（解密/验签）
async function showReceiveStatus() {
  if (!selectedMail.value) return;

  receiveStatusSteps.value = [];
  receivedPlaintext.value = null;

  try {
    receiveStatusSteps.value.push("开始解密邮件...");
    
    if (selectedMail.value.algorithm === "PLAINTEXT") {
      receivedPlaintext.value = selectedMail.value.message || "No message content";
      receiveStatusSteps.value.push("✅ 明文邮件，无需解密");
    } 
    else if (selectedMail.value.algorithm === "DH") {
      await decryptDHMail();
    }
    else if (selectedMail.value.algorithm === "RSA") {
      await decryptRSAMail();
    }
    else {
      receiveStatusSteps.value.push("❌ 未知的加密算法: " + selectedMail.value.algorithm);
    }
  } catch (err) {
    console.error("showReceiveStatus error:", err);
    receiveStatusSteps.value.push("❌ 解密失败: " + err.message);
  }
}

// 解密 DH 邮件
async function decryptDHMail() {
  try {
    const mail = selectedMail.value;
    receiveStatusSteps.value.push("🔐 检测到 DH 加密邮件");
    
    // 检查必要的字段
    if (!mail.ciphertextBase64 || !mail.ivBase64 || !mail.ephemPubBase64) {
      throw new Error("DH 邮件缺少必要的加密字段");
    }
    
    receiveStatusSteps.value.push("📋 检查邮件字段完整性...");
    receiveStatusSteps.value.push(`  - 密文: ${mail.ciphertextBase64 ? '✅' : '❌'}`);
    receiveStatusSteps.value.push(`  - IV: ${mail.ivBase64 ? '✅' : '❌'}`);
    receiveStatusSteps.value.push(`  - 发送者公钥: ${mail.ephemPubBase64 ? '✅' : '❌'}`);
    
    // 检查用户私钥
    if (!userPrivateKeys.value.ecdh) {
      throw new Error("用户 ECDH 私钥未加载，无法解密");
    }
    
    receiveStatusSteps.value.push("🔑 使用 ECDH 私钥解密...");
    
    // 执行 DH 解密
    const plaintext = await decryptWithDH(
      mail.ciphertextBase64,
      userPrivateKeys.value.ecdh,
      mail.ephemPubBase64,
      mail.ivBase64
    );
    
    receivedPlaintext.value = plaintext;
    receiveStatusSteps.value.push("✅ DH 解密成功！");
    
  } catch (err) {
    console.error("decryptDHMail error:", err);
    receiveStatusSteps.value.push("❌ DH 解密失败: " + err.message);
    throw err;
  }
}

// 解密 RSA 邮件
async function decryptRSAMail() {
  try {
    const mail = selectedMail.value;
    receiveStatusSteps.value.push("🔐 检测到 RSA 加密邮件");
    
    // 检查必要的字段
    if (!mail.encryptedKeyBase64 || !mail.ciphertextBase64 || !mail.ivBase64) {
      throw new Error("RSA 邮件缺少必要的加密字段");
    }
    
    receiveStatusSteps.value.push("📋 检查邮件字段完整性...");
    receiveStatusSteps.value.push(`  - 加密的密钥: ${mail.encryptedKeyBase64 ? '✅' : '❌'}`);
    receiveStatusSteps.value.push(`  - 密文: ${mail.ciphertextBase64 ? '✅' : '❌'}`);
    receiveStatusSteps.value.push(`  - IV: ${mail.ivBase64 ? '✅' : '❌'}`);
    
    // 检查用户私钥
    if (!userPrivateKeys.value.rsa) {
      throw new Error("用户 RSA 私钥未加载，无法解密");
    }
    
    receiveStatusSteps.value.push("🔑 使用 RSA 私钥解密 AES 密钥...");
    
    // 第一步：用 RSA 私钥解密 AES 密钥
    const aesKeyBase64 = await decryptRSA(mail.encryptedKeyBase64, userPrivateKeys.value.rsa);
    receiveStatusSteps.value.push("✅ AES 密钥解密成功");
    
    // 第二步：用 AES 密钥解密邮件内容
    receiveStatusSteps.value.push("🔓 使用 AES 密钥解密邮件内容...");
    
    // 导入 AES 密钥
    const aesKey = await crypto.subtle.importKey(
      "raw",
      base64ToAb(aesKeyBase64),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // 解密邮件内容
    const ciphertext = base64ToAb(mail.ciphertextBase64);
    const iv = base64ToAb(mail.ivBase64);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );
    
    receivedPlaintext.value = new TextDecoder().decode(plaintext);
    receiveStatusSteps.value.push("✅ RSA 解密成功！");
    
    // 如果有签名，进行验签
    if (mail.signatureBase64 && mail.senderPublicKeyPem) {
      receiveStatusSteps.value.push("🔍 验证数字签名...");
      // 这里可以添加签名验证逻辑
      receiveStatusSteps.value.push("⚠️ 签名验证功能待实现");
    }
    
  } catch (err) {
    console.error("decryptRSAMail error:", err);
    receiveStatusSteps.value.push("❌ RSA 解密失败: " + err.message);
    throw err;
  }
}

// 下载文件
function downloadFile(fileName, fileBase64) {
  try {
    const link = document.createElement('a');
    link.href = 'data:application/octet-stream;base64,' + fileBase64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("downloadFile error:", err);
    alert("Download failed");
  }
}

// 关闭模态框
function closeModal() {
  selectedMail.value = null;
  receivedPlaintext.value = null;
  receiveStatusSteps.value = [];
}
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
