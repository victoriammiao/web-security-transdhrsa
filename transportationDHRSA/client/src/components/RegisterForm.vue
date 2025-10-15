<template>
  <div class="register-form">
    <h2>Register</h2>
    <input v-model="username" placeholder="Username" />
    <input v-model="password" placeholder="Password" type="password" />
    <button @click="register">Register</button>
  </div>
</template>

<script setup>
import { ref } from "vue";

const emit = defineEmits(["registered"]);

const username = ref("");
const password = ref("");

// 注册函数
const register = async () => {
  if (!username.value || !password.value) {
    alert("Please enter username and password");
    return;
  }

  try {
    // 1️⃣ 生成本地公钥（临时或伪造），可改为真实RSA/DH生成
    const rsaPublicSpkiBase64 = "fake_rsa_public_key";
    const ecdhPublicRawBase64 = "fake_ecdh_public_key";

    // 2️⃣ 调用后端注册接口
    const res = await fetch("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
        rsaPublicSpkiBase64,
        ecdhPublicRawBase64,
      }),
    });

    const data = await res.json();

    // 3️⃣ 成功后发出事件
    if (res.ok && data.success) {
      alert("Registration successful!");
      emit("registered", { username: username.value });
    } else {
      alert("Registration failed: " + (data.message || "Unknown error"));
    }
  } catch (err) {
    console.error("Register failed:", err);
    alert("Network or server error, see console for details");
  }
};
</script>

<style scoped>
.register-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
}
input {
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 6px;
  width: 200px;
}
button {
  padding: 8px 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
button:hover {
  background: #1d4ed8;
}
</style>
