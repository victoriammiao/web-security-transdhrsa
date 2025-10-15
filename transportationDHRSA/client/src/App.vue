<template>
  <div class="app">
    <h1>🔐 Secure Mail (DH & RSA)</h1>

    <!-- Step 1：注册 / 登录 -->
    <div v-if="!registered" class="register-container">
      <RegisterForm @registered="handleRegistered" />
    </div>

    <!-- Step 2：邮箱主界面 -->
    <div v-else class="mailbox-container">
      <div class="top-bar">
        <span>👤 User: {{ username }}</span>
        <span>Mode: 
          <select v-model="mode">
            <option value="DH">DH</option>
            <option value="RSA">RSA</option>
          </select>
        </span>
        <button @click="logout">Logout</button>
      </div>

      <!-- 邮箱主界面 -->
      <Mailbox 
        :username="username" 
        :mode="mode" 
        @view-mail="viewMail"
      />

      <!-- 邮件详情弹窗 -->
      <MailView 
        v-if="selectedMail" 
        :mail="selectedMail" 
        @close="selectedMail = null"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import RegisterForm from "./components/RegisterForm.vue";
import Mailbox from "./components/Mailbox.vue";
import MailView from "./components/MailView.vue";

const registered = ref(false);
const username = ref("");
const mode = ref("DH");
const selectedMail = ref(null);

/** 注册成功后的处理 */
function handleRegistered(payload) {
  if (!payload) return; // 防止 emit(undefined)
  const { username: u, mode: m } = payload;
  username.value = u;
  mode.value = m;
  registered.value = true;
}

/** 点击查看邮件 */
function viewMail(mail) {
  selectedMail.value = mail;
}

/** 登出操作 */
function logout() {
  localStorage.clear();
  registered.value = false;
  username.value = "";
  selectedMail.value = null;
}
</script>

<style>
body {
  background: #f4f5f7;
  font-family: Arial, sans-serif;
  margin: 0;
}

.app {
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

select {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
}

button {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
}
button:hover {
  background: #1d4ed8;
}
</style>
