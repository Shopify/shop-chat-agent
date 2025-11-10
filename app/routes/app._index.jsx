import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { chatService } from "../config";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const chatConversations = await chatService.getShopConversationHistory(
    session.shop,
  );

  return { chatConversations };
}

export default function Index() {
  /** @type {{ chatConversations: import("../domain/message").Conversation[] }} */
  const { chatConversations } = useLoaderData();
  return (
    <s-page heading="Esquad">
      <ui-title-bar title="Shop chat agent reference app" />
      <s-section>
        <s-heading>eSquad Chat agent</s-heading>
        {chatConversations.length === 0 ? (
          <EmptyState />
        ) : (
          <ConversationsTable conversations={chatConversations} />
        )}
      </s-section>
    </s-page>
  );
}

/**
 * @param {{ conversations: import("../domain/message").Conversation[] }} props
 */
const ConversationsTable = ({ conversations }) => (
  <s-section>
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Id</s-table-header>
        <s-table-header listSlot="primary">Created</s-table-header>
        <s-table-header listSlot="primary">Updated</s-table-header>
        <s-table-header listSlot="primary">View</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {conversations.map((conversation) => (
          <ConversationRow key={conversation.id} conversation={conversation} />
        ))}
      </s-table-body>
    </s-table>
  </s-section>
);

/**
 * @param {{ conversation: import("../domain/message").Conversation }} props
 */
const ConversationRow = ({ conversation }) => {
  const createdAtDate = conversation.createdAt.toLocaleString();
  const updatedAtDate = conversation.updatedAt.toLocaleString();
  return (
    <s-table-row>
      <s-table-cell>{conversation.id}</s-table-cell>
      <s-table-cell>{createdAtDate}</s-table-cell>
      <s-table-cell>{updatedAtDate}</s-table-cell>
      <s-table-cell>
        <s-button>View</s-button>
      </s-table-cell>
    </s-table-row>
  );
};

const EmptyState = () => (
  <s-section accessibilityLabel="Empty state section">
    <s-heading>No conversation</s-heading>
  </s-section>
);
