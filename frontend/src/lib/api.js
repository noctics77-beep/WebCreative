import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const adminApi = (password) =>
  axios.create({
    baseURL: API,
    headers: { "X-Admin-Password": password },
  });

export const formatIDR = (n) =>
  "Rp " + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/** Prepend backend URL if photo is a server-relative path (uploaded via admin). */
export const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("/api/") || url.startsWith("/uploads/")) {
    return BACKEND_URL + (url.startsWith("/uploads/") ? "/api" + url : url);
  }
  return url;
};

export async function downloadAdminFile(password, path, params = {}) {
  const res = await axios.get(API + path, {
    headers: { "X-Admin-Password": password },
    params,
    responseType: "blob",
  });
  // Get filename from Content-Disposition
  const disp = res.headers["content-disposition"] || "";
  const match = /filename="?([^";]+)"?/.exec(disp);
  const filename = match ? match[1] : "export.bin";
  const blob = new Blob([res.data], { type: res.headers["content-type"] });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
