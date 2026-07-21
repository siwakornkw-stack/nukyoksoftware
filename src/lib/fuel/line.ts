import * as line from "@line/bot-sdk";

// LINE SDK wrappers (ported from โปรแกรมนำมัน/src/line.js).
let _client: line.messagingApi.MessagingApiClient | undefined;
let _blob: line.messagingApi.MessagingApiBlobClient | undefined;

// Image processing can outlive LINE's one-minute reply-token window. An image
// acknowledgement consumes the token and records where to push the final result.
const acknowledgedReplyDestinations = new Map<string, string>();

function client() {
  _client ??= new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "",
  });
  return _client;
}
function blobClient() {
  _blob ??= new line.messagingApi.MessagingApiBlobClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "",
  });
  return _blob;
}

export async function downloadImage(messageId: string): Promise<Buffer> {
  const stream = await blobClient().getMessageContent(messageId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function reply(replyToken: string, text: string): Promise<void> {
  const destination = acknowledgedReplyDestinations.get(replyToken);
  if (destination) {
    acknowledgedReplyDestinations.delete(replyToken);
    await client().pushMessage({ to: destination, messages: [{ type: "text", text }] });
    return;
  }
  await client().replyMessage({ replyToken, messages: [{ type: "text", text }] });
}

export async function acknowledgeImage(
  replyToken: string,
  destination: string,
  text: string
): Promise<void> {
  await client().replyMessage({ replyToken, messages: [{ type: "text", text }] });
  acknowledgedReplyDestinations.set(replyToken, destination);
}

// recipients: array of LINE ids (or a raw string with ids separated by comma/space/newline)
export async function alertAdmin(recipients: string | string[], text: string): Promise<void> {
  const ids = (Array.isArray(recipients) ? recipients : String(recipients || "").split(/[\s,]+/))
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) {
    console.warn("no admin LINE id configured, skipping alert");
    return;
  }
  const c = client();
  for (const to of ids) {
    try {
      await c.pushMessage({ to, messages: [{ type: "text", text }] });
    } catch (err) {
      console.error("alert push failed for", to, "-", (err as Error)?.message);
    }
  }
}

export async function pushText(to: string, text: string): Promise<void> {
  await client().pushMessage({ to, messages: [{ type: "text", text }] });
}

export async function displayName(userId?: string): Promise<string | null> {
  if (!userId) return null;
  try {
    return (await client().getProfile(userId)).displayName;
  } catch {
    return null;
  }
}
