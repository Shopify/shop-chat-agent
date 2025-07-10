import { BlockStack, EmptyState, Text, Card } from "@shopify/polaris";

export const FaqLogs = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <BlockStack gap="200">
        <Text as="h3" variant="headingMd">
          FAQ Logs
        </Text>
        <Card>
          <EmptyState
            image="https://cdn.shopify.com/b/shopify-brochure2-assets/893cc27413970e872182a200ad6ec8c4.svg"
            heading="Queries about your store will show here"
          >
            <p>
              This is where you'll view what info shoppers are searching for and
              the responses Shopify sends to AI agents when shoppers ask about
              your store.
            </p>
          </EmptyState>
        </Card>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingMd">
        FAQ Logs
      </Text>
      <Card>
        <BlockStack gap="150">
          {logs.map((log) => (
            <div key={log.id}>{log.question}</div>
          ))}
        </BlockStack>
      </Card>
    </BlockStack>
  );
};
