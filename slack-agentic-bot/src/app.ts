import "dotenv/config";
import { App } from "@slack/bolt";
import { handleMessage } from "./listeners/messages";
import { publishHome } from "./services/home";

const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_BOT_TOKEN;

if (!appToken || !botToken) {
  console.error(
    "Missing SLACK_APP_TOKEN or SLACK_BOT_TOKEN. Copy .env.example to .env and set values."
  );
  process.exit(1);
}

const app = new App({
  token: botToken,
  appToken,
  socketMode: true,
});

// Render the Home tab whenever a user opens it
app.event("app_home_opened", async ({ event, client }) => {
  await publishHome(client, event.user);
});

app.event("message", async ({ event, client }) => {
  await handleMessage(event, client);
});

export { publishHome, app };

(async () => {
  await app.start();
  console.log("Slack bot is running (Socket Mode). Listening for messages…");
})();
