<template>
  <div class="register-form">
    <h2>Register</h2>
    <input v-model="username" placeholder="Username" />
    <input v-model="password" placeholder="Password" type="password" />
    <div style="display:flex; gap:8px;">
      <button @click="register">Register</button>
      <button @click="goToLogin" class="link">Already have an account? Login</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

const emit = defineEmits(["registered", "show-login"]);
const router = useRouter();

const username = ref("");
const password = ref("");

// 注册函数（修复并发送 username + password）
const register = async () => {
  if (!username.value || !password.value) {
    alert("Please enter username and password");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      emit("registered", { username: username.value });
    } else {
      console.error("Register failed:", data);
      alert("Register failed: " + (data.message || res.statusText));
    }
  } catch (err) {
    console.error("Register failed:", err);
    alert("Network or server error, see console for details");
  }
};

// 切换到登录界面：优先使用 router 跳转，同时 emit 事件供父组件处理
function goToLogin() {
  try {
    if (router) router.push("/login");
  } catch (e) {
    console.warn("router push failed:", e);
  }
  emit("show-login");
}
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
button.link {
  background: transparent;
  color: #2563eb;
  border: 1px solid transparent;
  padding: 8px 12px;
}
button.link:hover {
  background: rgba(37,99,235,0.08);
}
</style>
