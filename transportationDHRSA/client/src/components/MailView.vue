<template>
  <div v-if="mail" class="mail-view">
    <h2>📩 From: {{ mail.from }}</h2>
    <p><b>Subject:</b> {{ mail.subject }}</p>
    <p><b>Body:</b></p>
    <pre>{{ mail.body }}</pre>

    <div v-if="mail.fileBase64">
      <p><b>Attachment:</b> {{ mail.fileName }}</p>
      <button @click="downloadFile(mail.fileName, mail.fileBase64)">⬇️ Download</button>
    </div>

    <button @click="$router.back()">Back</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const mail = ref(null);

onMounted(async () => {
  const id = route.params.id;
  const res = await fetch(`http://localhost:3000/api/mail/read/${id}`);
  mail.value = await res.json();
});

function downloadFile(filename, base64) {
  const link = document.createElement("a");
  link.href = `data:application/octet-stream;base64,${base64}`;
  link.download = filename;
  link.click();
}
</script>

<style scoped>
.mail-view {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
</style>
