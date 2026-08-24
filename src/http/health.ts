import { Elysia } from "elysia";

export const healthPlugin = new Elysia().get("/health", () => ({
	status: "ok",
}));
