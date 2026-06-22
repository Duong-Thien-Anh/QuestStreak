import { authRouter } from "./auth-router";
import { houseRouter } from "./house-router";
import { walletRouter } from "./wallet-router";
import { taskRouter } from "./task-router";
import { habitRouter } from "./habit-router";
import { rewardRouter } from "./reward-router";
import { privilegeRouter } from "./privilege-router";
import { punishmentRouter } from "./punishment-router";
import { notebookRouter } from "./notebook-router";
import { logRouter } from "./log-router";
import { wheelRouter } from "./wheel-router";
import { gamificationRouter } from "./gamification-router";
import { notificationRouter } from "./notification-router";
import { inviteRouter } from "./invite-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  house: houseRouter,
  wallet: walletRouter,
  task: taskRouter,
  habit: habitRouter,
  reward: rewardRouter,
  privilege: privilegeRouter,
  punishment: punishmentRouter,
  wheel: wheelRouter,
  gamification: gamificationRouter,
  notification: notificationRouter,
  invite: inviteRouter,
  notebook: notebookRouter,
  log: logRouter,
});

export type AppRouter = typeof appRouter;
