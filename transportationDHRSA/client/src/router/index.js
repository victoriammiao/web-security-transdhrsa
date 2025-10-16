import { createRouter, createWebHistory } from "vue-router";
import LoginForm from "../components/LoginForm.vue";
import RegisterForm from "../components/RegisterForm.vue";
import Mailbox from "../components/Mailbox.vue";
import MailView from "../components/MailView.vue";

const routes = [
    { path: "/", redirect: "/login" },
    { path: "/login", component: LoginForm },
    { path: "/register", component: RegisterForm },
    { path: "/mailbox", component: Mailbox },        // /mailbox?username=...
    { path: "/mail/:id", component: MailView, props: true },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;