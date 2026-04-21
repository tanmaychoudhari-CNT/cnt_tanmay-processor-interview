import { api, unwrap } from "./api";

export const login = (username, password) =>
  unwrap(api.post("/auth/login", { username, password }));

export const me = () => unwrap(api.get("/auth/me"));

export const logout = () => unwrap(api.post("/auth/logout"));
