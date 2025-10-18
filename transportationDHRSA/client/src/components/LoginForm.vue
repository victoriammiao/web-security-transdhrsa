<template>
  <div class="login-form">
    <h2>Login</h2>
    <input v-model="username" placeholder="Username" />
    <input v-model="password" type="password" placeholder="Password" />
    <div style="display:flex; gap:8px;">
      <button @click="login">Login</button>
      <button @click="goToRegister" class="link">Register</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

const emit = defineEmits(["logged-in","show-register"]);
const router = useRouter();

const username = ref("");
const password = ref("");

async function login() {
  if (!username.value || !password.value) {
    alert("请输入用户名和密码");
    return;
  }
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (data.token) localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username || username.value);
      emit("logged-in", { username: data.username || username.value });
      router.push({ path: "/mailbox", query: { username: data.username || username.value } });
    } else {
      alert("登录失败: " + (data.message || res.statusText));
    }
  } catch (err) {
    console.error(err);
    alert("网络错误，查看控制台");
  }
}

function goToRegister() {
  emit("show-register");
  try { router.push("/register"); } catch(e) {}
}
</script>

<style scoped>
.login-form { display:flex; flex-direction:column; gap:10px; align-items:center; padding:16px; }
input { width:220px; padding:6px; border-radius:6px; border:1px solid #ccc; }
button { padding:8px 12px; border-radius:6px; background:#2563eb; color:#fff; border:none; cursor:pointer; }
button.link { background:transparent; color:#2563eb; }
</style>