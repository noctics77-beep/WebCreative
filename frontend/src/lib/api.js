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
