const BASE = "/api";

export async function registerUserAPI(data) {
    const res = await fetch(`${BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function getAllUsersAPI() {
    const res = await fetch(`${BASE}/users`);
    return res.json();
}

export async function sendMailAPI(mail) {
    const res = await fetch(`${BASE}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mail)
    });
    return res.json();
}

export async function fetchInboxAPI(username) {
    const res = await fetch(`${BASE}/mails/${encodeURIComponent(username)}`);
    return res.json();
}
