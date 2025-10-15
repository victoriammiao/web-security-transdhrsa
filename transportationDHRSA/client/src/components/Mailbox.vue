<template>
  <div class="mailbox">
    <h2>📬 Welcome, {{ username }} (Mode: {{ mode }})</h2>

    <!-- ✉️ 发邮件区域 -->
    <div class="send-mail">
      <h3>Send Mail</h3>

      <select v-model="to">
        <option disabled value="">Select recipient</option>
        <option v-for="u in users" :key="u.username" :value="u.username">
          {{ u.username }}
        </option>
      </select>

      <input v-model="subject" placeholder="Subject..." />
      <textarea v-model="message" placeholder="Enter message..."></textarea>

      <!-- 📎 附件上传 -->
      <input type="file" @change="handleFileUpload" />
      <div v-if="fileName" class="file-preview">
        📎 Attached: {{ fileName }}
      </div>

      <button @click="sendMail">Send</button>
    </div>

    <!-- 📥 收件箱 -->
    <div class="inbox">
      <h3>Inbox</h3>
      <div v-for="mail in inbox" :key="mail._id" class="mail-item">
        <p><b>From:</b> {{ mail.from }}</p>
        <p><b>Subject:</b> {{ mail.subject || "(No subject)" }}</p>
        <p><b>Algorithm:</b> {{ mail.algorithm }}</p>
        <button @click="viewMail(mail._id)">View / Decrypt</button>
      </div>
    </div>

    <!-- 🧩 查看详情弹窗 -->
    <div v-if="selectedMail" class="modal">
      <div class="modal-content">
        <h3>📩 From: {{ selectedMail.from }}</h3>
        <p><b>Subject:</b> {{ selectedMail.subject }}</p>
        <p><b>Body:</b></p>
        <pre>{{ selectedMail.body }}</pre>

        <div v-if="selectedMail.fileBase64">
          <p><b>Attachment:</b> {{ selectedMail.fileName }}</p>
          <button @click="downloadFile(selectedMail.fileName, selectedMail.fileBase64)">
            ⬇️ Download
          </button>
        </div>

        <button @click="selectedMail = null">Close</button>
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
const inbox = ref([]);
const selectedMail = ref(null);

// 加载用户与收件箱
onMounted(async () => {
  await fetchUsers();
  await fetchInbox();
});

// 上传文件为 Base64
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

// 发送邮件
async function sendMail() {
  if (!to.value || !message.value) {
    alert("Please fill in recipient and message");
    return;
  }

  const payload = {
    from: props.username,
    to: to.value,
    subject: subject.value,
    body: message.value,
    algorithm: props.mode,
    fileBase64: fileBase64.value,
    fileName: fileName.value,
  };

  const res = await fetch("http://localhost:3000/api/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (res.ok) {
    alert("Mail sent successfully!");
    message.value = "";
    fileBase64.value = null;
    fileName.value = null;
    await fetchInbox();
  } else {
    alert("Send failed: " + data.message);
  }
}

// 获取所有用户
async function fetchUsers() {
  const res = await fetch("http://localhost:3000/api/users/all");
  users.value = await res.json();
}

// 获取收件箱
async function fetchInbox() {
  const res = await fetch(`http://localhost:3000/api/mail/inbox?username=${props.username}`);
  inbox.value = await res.json();
}

// 查看 / 解密邮件
async function viewMail(id) {
  const res = await fetch(`http://localhost:3000/api/mail/read/${id}`);
  selectedMail.value = await res.json();
}

// 下载附件
function downloadFile(filename, base64) {
  const link = document.createElement("a");
  link.href = `data:application/octet-stream;base64,${base64}`;
  link.download = filename;
  link.click();
}
</script>

<style scoped>
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
  max-width: 600px;
  width: 90%;
}
</style>
