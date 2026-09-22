import { afterEach, describe, expect, test, vi } from "vitest";
import { action } from "../app/routes/chat";
import { chatRequest, installShop, jsonResponse, readSseEvents, stubFetch } from "./helpers";

vi.mock("../app/services/claude.server", () => ({
  createClaudeService: () => ({
    streamConversation: async () => ({ role: "assistant", content: [], stop_reason: "end_turn" }),
  }),
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

async function sendChat(body) {
  stubFetch(() => jsonResponse({}));
  const response = await action({ request: chatRequest({ body }) });
  const events = await readSseEvents(response);
  return events.find(event => event.type === "id").conversation_id;
}

describe("conversation ids", () => {
  test("mints an unguessable id instead of adopting one the server never issued", async () => {
    await installShop();

    const issued = await sendChat({ message: "hi", conversation_id: "1740000000000" });

    expect(issued).not.toBe("1740000000000");
    expect(issued).toMatch(UUID);
  });

  test("continues a conversation the server previously issued", async () => {
    await installShop();
    const first = await sendChat({ message: "hi" });

    const second = await sendChat({ message: "again", conversation_id: first });

    expect(second).toBe(first);
  });

});
